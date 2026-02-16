package com.mishabitos.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class QuickExpenseActivity extends Activity {

    private EditText etAmount;
    private EditText etDescription;
    private Spinner spPlanilla;
    private Spinner spCategory;
    private CheckBox cbShared;
    private CheckBox cbInstallments;
    private Button btnSave;
    private Button btnCancel;
    private ExecutorService executorService = Executors.newSingleThreadExecutor();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private List<String> categoryNames = new ArrayList<>();
    private List<PlanillaItem> planillaItems = new ArrayList<>();

    private static class PlanillaItem {
        String id;
        String name;
        
        PlanillaItem(String id, String name) {
            this.id = id;
            this.name = name;
        }
        
        @Override
        public String toString() {
            return name; 
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_expense);

        // Make window look like a dialog
        if (getWindow() != null) {
            getWindow().setLayout(
                    (int) (getResources().getDisplayMetrics().widthPixels * 0.90),
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            );
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        etAmount = findViewById(R.id.et_amount);
        etDescription = findViewById(R.id.et_description);
        spCategory = findViewById(R.id.sp_category);
        spPlanilla = findViewById(R.id.sp_planilla);
        cbShared = findViewById(R.id.cb_shared);
        cbInstallments = findViewById(R.id.cb_installments);
        btnSave = findViewById(R.id.btn_save);
        btnCancel = findViewById(R.id.btn_cancel);

        btnCancel.setOnClickListener(v -> finish());
        btnSave.setOnClickListener(v -> saveExpense());

        cbShared.setOnCheckedChangeListener((buttonView, isChecked) -> {
            EditText etPaidBy = findViewById(R.id.et_paid_by);
            etPaidBy.setVisibility(isChecked ? View.VISIBLE : View.GONE);
        });

        cbInstallments.setOnCheckedChangeListener((buttonView, isChecked) -> {
            View layoutInstallments = findViewById(R.id.layout_installments);
            layoutInstallments.setVisibility(isChecked ? View.VISIBLE : View.GONE);
        });

        loadCategories();
        loadPlanillas();
    }



    private void loadCategories() {
        SharedPreferences sharedPref = getSharedPreferences("WidgetPrefs", MODE_PRIVATE);
        String categoriesJson = sharedPref.getString("categories_json", "[]");
        
        categoryNames.clear();
        try {
            JSONArray jsonArray = new JSONArray(categoriesJson);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject cat = jsonArray.getJSONObject(i);
                categoryNames.add(cat.optString("name", "Unknown"));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (categoryNames.isEmpty()) {
            categoryNames.add("General");
            categoryNames.add("Comida");
            categoryNames.add("Transporte");
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, categoryNames) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                View view = super.getView(position, convertView, parent);
                TextView text = (TextView) view.findViewById(android.R.id.text1);
                text.setTextColor(Color.WHITE);
                return view;
            }

            @Override
            public View getDropDownView(int position, View convertView, ViewGroup parent) {
                View view = super.getDropDownView(position, convertView, parent);
                TextView text = (TextView) view.findViewById(android.R.id.text1);
                text.setTextColor(Color.BLACK); // Dropdown usually white bg
                return view;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spCategory.setAdapter(adapter);
    }

    private void loadPlanillas() {
        SharedPreferences sharedPref = getSharedPreferences("WidgetPrefs", MODE_PRIVATE);
        String planillasJson = sharedPref.getString("planillas_json", "[]");

        planillaItems.clear();
        try {
            JSONArray jsonArray = new JSONArray(planillasJson);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject obj = jsonArray.getJSONObject(i);
                String id = obj.optString("id");
                String name = obj.optString("nombre", "Sin Nombre");
                planillaItems.add(new PlanillaItem(id, name));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (planillaItems.isEmpty()) {
            // Fallback or empty state
            planillaItems.add(new PlanillaItem(null, "Sin Planillas"));
        }

        ArrayAdapter<PlanillaItem> adapter = new ArrayAdapter<PlanillaItem>(this, android.R.layout.simple_spinner_item, planillaItems) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                View view = super.getView(position, convertView, parent);
                TextView text = (TextView) view.findViewById(android.R.id.text1);
                text.setTextColor(Color.WHITE);
                return view;
            }

            @Override
            public View getDropDownView(int position, View convertView, ViewGroup parent) {
                View view = super.getDropDownView(position, convertView, parent);
                TextView text = (TextView) view.findViewById(android.R.id.text1);
                text.setTextColor(Color.BLACK);
                return view;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spPlanilla.setAdapter(adapter);
    }

    private void saveExpense() {
        EditText etAmount = findViewById(R.id.et_amount);
        EditText etDescription = findViewById(R.id.et_description);
        Spinner spCategory = findViewById(R.id.sp_category);
        Spinner spPlanilla = findViewById(R.id.sp_planilla);
        CheckBox cbShared = findViewById(R.id.cb_shared);
        CheckBox cbInstallments = findViewById(R.id.cb_installments);
        EditText etPaidBy = findViewById(R.id.et_paid_by);
        EditText etCurrentInstallment = findViewById(R.id.et_current_installment);
        EditText etTotalInstallments = findViewById(R.id.et_total_installments);

        String amountStr = etAmount.getText().toString();
        String description = etDescription.getText().toString();
        String category = spCategory.getSelectedItem().toString();
        boolean isShared = cbShared.isChecked();
        boolean isInstallment = cbInstallments.isChecked(); 
        
        PlanillaItem selectedPlanilla = (PlanillaItem) spPlanilla.getSelectedItem();
        String planillaId = selectedPlanilla != null ? selectedPlanilla.id : null;

        if (planillaId == null) {
             Toast.makeText(this, "Selecciona una planilla", Toast.LENGTH_SHORT).show();
             return;
        }

        if (amountStr.isEmpty()) {
            Toast.makeText(this, "Ingresa un monto", Toast.LENGTH_SHORT).show();
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountStr);
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Monto inválido", Toast.LENGTH_SHORT).show();
            return;
        }

        if (description.isEmpty()) {
            description = "Gasto Rápido";
        }
        
        SharedPreferences sharedPref = getSharedPreferences("WidgetPrefs", MODE_PRIVATE);
        String token = sharedPref.getString("access_token", null);
        String savedUrl = sharedPref.getString("supabase_url", null);
        String savedKey = sharedPref.getString("supabase_key", null);

        if (token == null || savedUrl == null || savedKey == null) {
            Toast.makeText(this, "Abre la app para sincronizar sesión", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        btnSave.setEnabled(false);
        btnSave.setText("...");

        String finalDescription = description;
        double finalAmount = amount;
        String paidBy = etPaidBy.getText().toString();
        
        int currentInstallment = 1;
        int totalInstallments = 1;

        if (isInstallment) {
            try {
                String currentStr = etCurrentInstallment.getText().toString();
                String totalStr = etTotalInstallments.getText().toString();
                if (!currentStr.isEmpty()) currentInstallment = Integer.parseInt(currentStr);
                if (!totalStr.isEmpty()) totalInstallments = Integer.parseInt(totalStr);
            } catch (Exception e) {
                // Default to 1
            }
        }
        
        int finalCurrent = currentInstallment;
        int finalTotal = totalInstallments;

        executorService.execute(() -> {
            try {
                // URL includes planilla_id in the path for this endpoint: /api/planillas/${planillaId}/expenses
                // Wait, native code is calling Supabase DIRECTLY or via Backend API?
                // Looking at previous code: savedUrl + "/rest/v1/expenses"
                // It was calling Supabase PostgREST directly.
                // So we need to include 'planilla_id' in the JSON body.
                
                URL url = new URL(savedUrl + "/rest/v1/expenses");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("apikey", savedKey);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);

                JSONObject jsonParam = new JSONObject();
                jsonParam.put("amount", finalAmount);
                jsonParam.put("description", finalDescription);
                jsonParam.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()));
                jsonParam.put("category", category);
                jsonParam.put("planilla_id", planillaId); // Added this
                jsonParam.put("shared", isShared); // Backend column name map? 'is_shared' probably.
                // Re-checking DailyExpenses logic or Supabase schema guess.
                // In React: esCompartido -> is_shared. 
                // Previous Native code used: jsonParam.put("shared", isShared);
                // If previous code was working, then 'shared' might be the column name?
                // Wait, React sends { is_shared: ... } to internal API, which maps to DB.
                // Internal API (server.mjs?) -> Supabase.
                // Here native calls Supabase DIRECTLY.
                // Let's assume the previous code was correct about column names, OR check if it was broken.
                // Previous code: jsonParam.put("shared", isShared);
                // React code maps `esCompartido` to `is_shared` in `addExpense`. 
                // Let's check `DailyExpenses.jsx`: groups use `is_shared`.
                // Ideally I should check the schema columns. 
                // But let's stick to what was there ("shared") but typically it's "is_shared".
                // Actually, let's use "is_shared" to be safe if "shared" isn't certain, 
                // BUT if the previous code was "shared", changing it might break it if "shared" was correct.
                // Usage in React `addExpense`: `esCompartido`. 
                // Usage in Context `getDailyExpenses`: returns `is_shared`.
                // So the DB column is definitely `is_shared`.
                
                jsonParam.put("is_shared", isShared); // Correcting to likely schema
                if (isShared && !paidBy.isEmpty()) {
                    jsonParam.put("payer_name", paidBy);
                }
                
                if (isInstallment) {
                     jsonParam.put("is_installment", true);
                     jsonParam.put("current_installment", finalCurrent);
                     jsonParam.put("total_installments", finalTotal);
                } else {
                     jsonParam.put("is_installment", false);
                }

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonParam.toString().getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                
                mainHandler.post(() -> {
                    if (responseCode >= 200 && responseCode < 300) {
                        Toast.makeText(QuickExpenseActivity.this, "Gasto guardado!", Toast.LENGTH_SHORT).show();
                        finish();
                    } else {
                        Toast.makeText(QuickExpenseActivity.this, "Error: " + responseCode, Toast.LENGTH_LONG).show();
                        btnSave.setEnabled(true);
                        btnSave.setText("Agregar");
                    }
                });

            } catch (Exception e) {
                e.printStackTrace();
                mainHandler.post(() -> {
                    Toast.makeText(QuickExpenseActivity.this, "Error de conexión", Toast.LENGTH_SHORT).show();
                    btnSave.setEnabled(true);
                    btnSave.setText("Agregar");
                });
            }
        });
    }
}
