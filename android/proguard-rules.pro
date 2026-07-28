# Add project specific ProGuard rules here.
-keep class com.formstr.fips.** { *; }
-keepclassmembers class com.formstr.fips.FipsBridge {
    native <methods>;
}
