package com.mishabitos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class ExpenseWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // La URL que Capacitor puede capturar (custom scheme)
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("mishabitos://add-expense"));
        intent.setPackage(context.getPackageName());
        
        // FLAG_IMMUTABLE es requerido en Android 12+
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_expense);
        views.setOnClickPendingIntent(R.id.btn_add_expense, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
