package com.formstr.fips;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class FipsForegroundService extends Service {

    private static final String CHANNEL_ID = "fips_node_channel";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("FIPS Mesh Node")
                .setContentText("FIPS mesh networking is active")
                .setSmallIcon(android.R.drawable.ic_menu_share)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "FIPS Node",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notification for FIPS mesh networking service");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
}
