use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::{jlong, jstring};
use std::sync::Mutex;
use std::sync::OnceLock;
use fips::{Node, Config, Identity};
use fips::config::{PeerConfig, PeerAddress, ConnectPolicy, TransportInstances, UdpConfig};
use fips::identity::{decode_npub, NodeAddr};
use serde::{Deserialize, Serialize};

static NODE: Mutex<Option<Node>> = Mutex::new(None);

fn runtime() -> &'static tokio::runtime::Runtime {
    static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    RT.get_or_init(|| tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime"))
}

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
    if let Some(ref level) = &jni_config.log_level {
        config.node.log_level = Some(level.clone());
    }

    let bind_addr = if let Some(port) = jni_config.udp_port {
        Some(format!("0.0.0.0:{}", port))
    } else {
        Some("0.0.0.0:0".to_string())
    };

    config.transports.udp = TransportInstances::Single(UdpConfig {
        bind_addr,
        ..Default::default()
    });

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

fn resolve_node_addr(npub_or_hex: &str) -> Option<NodeAddr> {
    if npub_or_hex.starts_with("npub1") {
        decode_npub(npub_or_hex).ok().map(|pk| NodeAddr::from_pubkey(&pk))
    } else {
        let bytes = hex::decode(npub_or_hex).ok()?;
        NodeAddr::from_slice(&bytes).ok()
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

    let mut node = Node::with_identity(identity, config).expect("Failed to create node");

    runtime().block_on(async {
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
        runtime().block_on(async {
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
        if let Some(node_addr) = resolve_node_addr(&to_npub) {
            runtime().block_on(async {
                if let Err(e) = node.send_encrypted_link_message(&node_addr, data.as_bytes()).await {
                    log::error!("sendDatagram failed: {:?}", e);
                }
            });
        } else {
            log::error!("sendDatagram: could not resolve npub to NodeAddr: {}", to_npub);
        }
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
        if let Some(node_addr) = resolve_node_addr(&to_node_addr) {
            runtime().block_on(async {
                if let Err(e) = node.send_encrypted_link_message(&node_addr, data.as_bytes()).await {
                    log::error!("sendDatagramByAddr failed: {:?}", e);
                }
            });
        } else {
            log::error!("sendDatagramByAddr: could not resolve to NodeAddr: {}", to_node_addr);
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativeListSessions(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let node_slot = NODE.lock().unwrap();
    if let Some(ref node) = *node_slot {
        let sessions: Vec<JniSessionInfo> = node.session_entries().map(|(addr, entry)| {
            let (ps, pr, bs, br) = entry.traffic_counters();
            JniSessionInfo {
                remote_npub: PeerIdentity::from_pubkey(entry.remote_pubkey().clone()).npub(),
                remote_node_addr: hex::encode(addr.as_bytes()),
                established: entry.is_established(),
                packets_sent: ps,
                packets_recv: pr,
                bytes_sent: bs,
                bytes_recv: br,
            }
        }).collect();
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
                npub: p.npub(),
                node_addr: hex::encode(p.node_addr().as_bytes()),
                transport: "udp".to_string(),
                link_established: p.can_send(),
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
        runtime().block_on(async {
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
    let _npub: String = env.get_string(&npub).unwrap().into();
    let mut node_slot = NODE.lock().unwrap();
    if let Some(ref mut node) = *node_slot {
        // TODO: Need a way to remove a specific peer by npub.
        // update_peers replaces the entire peer list.
        log::warn!("removePeer not yet implemented — requires per-peer removal API in fips crate");
        let _ = node;
    }
}

#[no_mangle]
pub extern "system" fn Java_com_formstr_fips_FipsBridge_nativePollDatagram(
    mut env: JNIEnv,
    _class: JClass,
    _timeout_ms: jni::sys::jint,
) -> jstring {
    // TODO: Datagram receive requires a public API on the fips crate
    // to receive session-layer datagrams from the Node.
    env.new_string("").unwrap().into_raw()
}
