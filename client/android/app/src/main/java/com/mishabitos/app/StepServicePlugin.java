package com.mishabitos.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StepService")
public class StepServicePlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, StepCounterService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error starting service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, StepCounterService.class);
        ctx.stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStepCount(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            StepCounterService.PREFS_NAME, Context.MODE_PRIVATE);
        int steps = prefs.getInt(StepCounterService.KEY_STEPS_TODAY, 0);
        String date = prefs.getString(StepCounterService.KEY_STEP_DATE, "");

        JSObject result = new JSObject();
        result.put("steps", steps);
        result.put("date", date);
        call.resolve(result);
    }

    @PluginMethod
    public void setGoal(PluginCall call) {
        Integer goal = call.getInt("goal");
        if (goal == null) {
            call.reject("goal required");
            return;
        }
        getContext().getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(StepCounterService.KEY_STEPS_GOAL, goal)
            .apply();
        call.resolve();
    }
}
