use jni::JNIEnv;
use jni::objects::{JClass, JString, JObject};
use jni::sys::{jlong, jstring, jobject};
use std::sync::Mutex;
use std::collections::VecDeque;
use fips::{Node, Config, Identity, NodeState};
use fips::config::{PeerConfig, PeerAddress, ConnectPolicy};
use serde::{Deserialize, Serialize};

static NODE: Mutex<Option<Node>> = Mutex::new(None);
static RUNTIME: Mutex<Option<tokio::runtime::Runtime>> = Mutex::new(None);
static DATAGRAM_QUEUE: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());

#[derive(Deserialize)]
struct JniConfig {
    nsec: Option<String>,
    persistent: Option<bool>,
    leaf_only: Option<bool>,
    udp_port: Option<u16>,
    log_level: Option<String>,
    nostr_discovery: Option<bool>,
    lan_discovery: Option<bool>,
    nostr_relays: Option<Vec<String>>,
    peers: Option<Vec<JniPeerConfig>>,
}

#[derive(Deserialize)]
struct JniPeerConfig {
    npub: String,
    transport: Option<String>,
    addr: Option<String>,
    connect_policy: Option<String>,
}

#[derive(Serialize)]
struct JniStatus {
    state: String,
    npub: String,
    node_addr: String,
    fips_address: String,
    peer_count: usize,
    session_count: usize,
    link_count: usize,
    transport_count: usize,
    uptime_secs: u64,
    estimated_mesh_size: Option<u64>,
    tun_name: Option<String>,
}

#[derive(Serialize)]
struct JniSessionInfo {
    remote_npub: String,
    remote_node_addr: String,
    established: bool,
    packets_sent: u64,
    packets_recv: u64,
    bytes_sent: u64,
    bytes_recv: u64,
}

#[derive(Serialize)]
struct JniPeerInfo {
    npub: String,
    node_addr: String,
    transport: String,
    link_established: bool,
    rtt_ms: Option<f64>,
    loss_percent: Option<f64>,
    jitter_ms: Option<f64>,
    bytes_sent: u64,
    bytes_recv: u64,
}

#[derive(Serialize)]
struct JniDatagram {
    from_npub: String,
    from_node_addr: String,
    data: String,
}

fn get_runtime() -> &'static tokio::runtime::Runtime {
    let mut rt = RUNTIME.lock().unwrap();
    if rt.is_none() {
        *rt = Some(tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime"));
    }
    rt.as_ref().unwrap()
}

fn build_config(jni_config: &JniConfig) -> Config {
    let mut config = Config::new();

    if let Some(ref nsec) = jni_config.nsec {
        config.node.identity.nsec = Some(nsec.clone());
    }
    if let Some(persistent) = jni_config.persistent {
        config.node.identity.persistent = persistent;
    }
    if jni_config.leaf_only.unwrap_or(false) {
        config.node.leaf_only = true;
    }
    if let Some(level) = &jni_config.log_level {
        config.node.log_level = Some(level.clone());
    }

    if let Some(port) = jni_config.udp_port {
        config.transports.udp.push(fips::config::UdpConfig {
            bind_addr: format!("0.0.0.0:{}", port),
            ..Default::default()
        });
    } else {
        config.transports.udp.push(fips::config::UdpConfig {
            bind_addr: "0.0.0.0:0".to_string(),
            ..Default::default()
        });
    }

    if let Some(ref peers) = jni_config.peers {
        config.peers = peers.iter().map(|p| {
            let mut pc = PeerConfig {
                npub: p.npub.clone(),
                ..Default::default()
            };
            if let Some(ref transport) = p.transport {
                if let Some(ref addr) = p.addr {
                    pc.addresses.push(PeerAddress {
                        transport: transport.clone(),
                        addr: addr.clone(),
                        priority: 100,
                        seen_at_ms: None,
                    });
                }
            }
            if let Some(ref policy) = p.connect_policy {
                pc.connect_policy = match policy.as_str() {
                    "on_demand" => ConnectPolicy::OnDemand,
                    "manual" => ConnectPolicy::Manual,
                    _ => ConnectPolicy::AutoConnect,
                };
            }
            pc
        }).collect();
    }

    config
}

fn node_status(node: &Node) -> JniStatus {
    JniStatus {
        state: format!("{:?}", node.state()).to_lowercase(),
        npub: node.npub(),
        node_addr: hex::encode(node.node_addr().as_bytes()),
        fips_address: node.identity().address().to_string(),
        peer_count: node.peer_count(),
        session_count: node.session_count(),
        link_count: node.link_count(),
        transport_count: node.transport_count(),
        uptime_secs: node.uptime().as_secs(),
        estimated_mesh_size: node.estimated_mesh_size(),
        tun_name: node.tun_name().map(|s| s.to_string()),
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeStart(
    mut env: JNIEnv,
    _class: JClass,
    config_json: JString,
) -> jstring {
    android_logger::init_once(
        android_logger::Config::default()
            .with_max_level(log::LevelFilter::Info)
            .with_tag("fips-jni"),
    );

    let config_str: String = env.get_string(&config_json).unwrap().into();
    let jni_config: JniConfig = serde_json::from_str(&config_str).expect("Invalid config JSON");

    let config = build_config(&jni_config);
    let identity = if let Some(ref nsec) = jni_config.nsec {
        Identity::from_secret_str(nsec).expect("Invalid nsec")
    } else {
        Identity::generate()
    };

    let rt = get_runtime();
    let mut node = Node::with_identity(identity, config).expect("Failed to create node");

    rt.block_on(async {
        node.start().await.expect("Failed to start node");
    });

    let status = node_status(&node);
    let status_json = serde_json::to_string(&status).unwrap();

    let mut node_slot = NODE.lock().unwrap();
    *node_slot = Some(node);

    env.new_string(status_json).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeGetHandle(
    _env: JNIEnv,
    _class: JClass,
) -> jlong {
    let node_slot = NODE.lock().unwrap();
    if node_slot.is_some() { 1 } else { 0 }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeStop(
    _env: JNIEnv,
    _class: JClass,
) {
    let mut node_slot = NODE.lock().unwrap();
    if let Some(mut node) = node_slot.take() {
        let rt = get_runtime();
        rt.block_on(async {
            let _ = node.stop().await;
        });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeGetStatus(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        let status = node_status(node);
        let json = serde_json::to_string(&status).unwrap();
        env.new_string(json).unwrap().into_raw()
    } else {
        env.new_string("{}").unwrap().into_raw()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeGetNpub(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        env.new_string(node.npub()).unwrap().into_raw()
    } else {
        env.new_string("").unwrap().into_raw()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeGetAddress(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        env.new_string(node.identity().address().to_string()).unwrap().into_raw()
    } else {
        env.new_string("").unwrap().into_raw()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeSendDatagram(
    mut env: JNIEnv,
    _class: JClass,
    to_npub: JString,
    data: JString,
) {
    let to_npub: String = env.get_string(&to_npub).unwrap().into();
    let data: String = env.get_string(&data).unwrap().into();

    let mut node_slot = NODE.lock().unwrap();
    if let Some(ref mut node) = *node_slot {
        let rt = get_runtime();
        rt.block_on(async {
            let _ = node.send_encrypted_link_message(
                &fips::NodeAddr::from_npub(&to_npub).unwrap(),
                data.as_bytes(),
            ).await;
        });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeSendDatagramByAddr(
    mut env: JNIEnv,
    _class: JClass,
    to_node_addr: JString,
    data: JString,
) {
    let to_node_addr: String = env.get_string(&to_node_addr).unwrap().into();
    let data: String = env.get_string(&data).unwrap().into();

    let mut node_slot = NODE.lock().unwrap();
    if let Some(ref mut node) = *node_slot {
        let rt = get_runtime();
        rt.block_on(async {
            let _ = node.send_encrypted_link_message(
                &fips::NodeAddr::from_hex(&to_node_addr).unwrap(),
                data.as_bytes(),
            ).await;
        });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeListSessions(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        let sessions: Vec<JniSessionInfo> = vec![]; // TODO: iterate session_entries
        let json = serde_json::to_string(&sessions).unwrap();
        env.new_string(json).unwrap().into_raw()
    } else {
        env.new_string("[]").unwrap().into_raw()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeListPeers(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        let peers: Vec<JniPeerInfo> = node.peers().map(|p| {
            JniPeerInfo {
                npub: p.identity().npub(),
                node_addr: hex::encode(p.node_addr().as_bytes()),
                transport: "udp".to_string(),
                link_established: p.is_established(),
                rtt_ms: None,
                loss_percent: None,
                jitter_ms: None,
                bytes_sent: 0,
                bytes_recv: 0,
            }
        }).collect();
        let json = serde_json::to_string(&peers).unwrap();
        env.new_string(json).unwrap().into_raw()
    } else {
        env.new_string("[]").unwrap().into_raw()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeAddPeer(
    mut env: JNIEnv,
    _class: JClass,
    peer_json: JString,
) {
    let peer_str: String = env.get_string(&peer_json).unwrap().into();
    let jni_peer: JniPeerConfig = serde_json::from_str(&peer_str).expect("Invalid peer JSON");

    let mut node_slot = NODE.lock().unwrap();
    if let Some(ref mut node) = *node_slot {
        let mut pc = PeerConfig {
            npub: jni_peer.npub,
            ..Default::default()
        };
        if let Some(ref transport) = jni_peer.transport {
            if let Some(ref addr) = jni_peer.addr {
                pc.addresses.push(PeerAddress {
                    transport: transport.clone(),
                    addr: addr.clone(),
                    priority: 100,
                    seen_at_ms: None,
                });
            }
        }
        let rt = get_runtime();
        rt.block_on(async {
            let _ = node.update_peers(vec![pc]).await;
        });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeRemovePeer(
    mut env: JNIEnv,
    _class: JClass,
    npub: JString,
) {
    let npub: String = env.get_string(&npub).unwrap().into();
    let mut node_slot = NODE.lock().unwrap();
    if let Some(ref mut node) = *node_slot {
        let rt = get_runtime();
        rt.block_on(async {
            let _ = node.update_peers(vec![]).await;
        });
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativePollDatagram(
    mut env: JNIEnv,
    _class: JClass,
    timeout_ms: jni::sys::jint,
) -> jstring {
    let mut queue = DATAGRAM_QUEUE.lock().unwrap();
    if let Some(datagram) = queue.pop_front() {
        env.new_string(datagram).unwrap().into_raw()
    } else {
        std::mem::drop(queue);
        std::thread::sleep(std::time::Duration::from_millis(timeout_ms as u64));
        let mut queue = DATAGRAM_QUEUE.lock().unwrap();
        if let Some(datagram) = queue.pop_front() {
            env.new_string(datagram).unwrap().into_raw()
        } else {
            env.new_string("").unwrap().into_raw()
        }
    }
}
