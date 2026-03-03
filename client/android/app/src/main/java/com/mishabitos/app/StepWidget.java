package com.mishabitos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.util.Locale;

public class StepWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(
            StepCounterService.PREFS_NAME, Context.MODE_PRIVATE);
        int steps = prefs.getInt(StepCounterService.KEY_STEPS_TODAY, 0);
        int goal = prefs.getInt(StepCounterService.KEY_STEPS_GOAL, 8000);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_steps);
        views.setTextViewText(R.id.tv_step_count, formatNumber(steps));
        views.setTextViewText(R.id.tv_step_goal, "/ " + formatNumber(goal));
        views.setProgressBar(R.id.pb_steps, goal, Math.min(steps, goal), false);

        // Toque en el widget → abre la app
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 1, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static String formatNumber(int n) {
        if (n >= 1000) {
            return String.format(Locale.getDefault(), "%,d", n);
        }
        return String.valueOf(n);
    }
}
