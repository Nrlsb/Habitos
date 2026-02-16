package com.mishabitos.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetAuth")
public class WidgetAuthPlugin extends Plugin {

    @PluginMethod
    public void saveAuthToken(PluginCall call) {
        String token = call.getString("token");
        String url = call.getString("url");
        String key = call.getString("key");
        
        if (token == null || url == null || key == null) {
            call.reject("Token, URL and Key required");
            return;
        }

        Context context = getContext();
        SharedPreferences sharedPref = context.getSharedPreferences("WidgetPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putString("access_token", token);
        editor.putString("supabase_url", url);
        editor.putString("supabase_key", key);
        editor.apply();

        call.resolve();
    }

    @PluginMethod
    public void saveCategories(PluginCall call) {
        String categoriesJson = call.getString("categories");
        
        if (categoriesJson == null) {
            call.reject("Categories JSON required");
            return;
        }

        Context context = getContext();
        SharedPreferences sharedPref = context.getSharedPreferences("WidgetPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putString("categories_json", categoriesJson);
        editor.apply();

        call.resolve();
    }

    @PluginMethod
    public void savePlanillas(PluginCall call) {
        String planillasJson = call.getString("planillas");
        
        if (planillasJson == null) {
            call.reject("Planillas JSON required");
            return;
        }

        Context context = getContext();
        SharedPreferences sharedPref = context.getSharedPreferences("WidgetPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putString("planillas_json", planillasJson);
        editor.apply();

        call.resolve();
    }
}
