import React, { useEffect, useState } from "react";

// Kodhiyas Orders — Canvas-ready single-file React app
// Offline-first (localStorage), 3 tabs: Sales, Purchase, Outstanding
// Grouped dashboard by Broker + Party (Buyer/Seller), editable orders, pending auto-calculation

const COMMODITIES = [
  "Cotton",
  "Degummed Soybean Oil",
  "Palmolien Oil",
  "Super Palmolien Oil",
  "Soybean Refined Oil",
  "Crude Palm Oil",
  "RBD Refined Oil",
  "Sunflower Refined Oil",
];

const UNITS = ["MT", "QTL", "KG"];
const STORAGE_KEY = "kodhiyas_orders_v2";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveOrders(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

export default function KodhiyasOrdersApp() {
  const [tab, setTab] = useState("sales"); // 'sales' | 'purchase' | 'outstanding'
  const [orders, setOrders] = useState(() => loadOrders());
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [filterText, setFilterText] = useState("");

  const emptyForm = {
    id: null,
    type: "SALES", // SALES or PURCHASE
    partyName: "", // buyer or seller
    brokerName: "",
    commodity: COMMODITIES[0],
    quantity: "",
    unit: UNITS[0],
    quantityGiven: "",
    rate: "",
    timestamp: nowISO(),
    remarks: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  // Derived lists
  const salesOrders = orders.filter((o) => o.type === "SALES");
  const purchaseOrders = orders.filter((o) => o.type === "PURCHASE");

  // Helpers
  function computePending(q, g) {
    const qn = parseFloat(q) || 0;
    const gn = parseFloat(g) || 0;
    return Math.round((qn - gn) * 1000) / 1000;
  }

  function handleSave() {
    if (!form.partyName.trim()) {
      alert("Please enter Buyer/Seller name.");
      return;
    }
    const item = {
      ...form,
      quantity: parseFloat(form.quantity) || 0,
      quantityGiven: parseFloat(form.quantityGiven) || 0,
      pending: computePending(form.quantity, form.quantityGiven),
      timestamp: form.timestamp || nowISO(),
    };

    setOrders((prev) => {
      const others = prev.filter((p) => p.id !== item.id);
      if (!item.id) item.id = uid();
      return [item, ...others];
    });

    setForm(emptyForm);
    setIsEditing(false);
    // remain on same tab
  }

  function handleEdit(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    setForm({
      id: o.id,
      type: o.type,
      partyName: o.partyName,
      brokerName: o.brokerName,
      commodity: o.commodity,
      quantity: String(o.quantity),
      unit: o.unit || UNITS[0],
      quantityGiven: String(o.quantityGiven),
      rate: o.rate != null ? String(o.rate) : "",
      timestamp: o.timestamp,
      remarks: o.remarks || "",
    });
    setIsEditing(true);
    setTab(o.type === "SALES" ? "sales" : "purchase");
  }

  function handleDelete(id) {
    if (!confirm("Delete this order?")) return;
    setOrders((prev) => prev.filter((x) => x.id !== id));
  }

  function addSampleData() {
    const sample = [
      {
        id: uid(),
        type: "SALES",
        partyName: "Govind",
        brokerName: "Ramesh",
        commodity: "Palmolien Oil",
        quantity: 500,
        unit: "MT",
        quantityGiven: 120,
        rate: 1000,
        timestamp: nowISO(),
        remarks: "",
      },
      {
        id: uid(),
        type: "SALES",
        partyName: "Govind",
        brokerName: "Ramesh",
        commodity: "Palmolien Oil",
        quantity: 200,
        unit: "MT",
        quantityGiven: 50,
        rate: 1010,
        timestamp: nowISO(),
        remarks: "",
      },
      {
        id: uid(),
        type: "PURCHASE",
        partyName: "Upendra",
        brokerName: "Suresh",
        commodity: "Cotton",
        quantity: 100,
        unit: "MT",
        quantityGiven: 40,
        rate: 500,
        timestamp: nowISO(),
        remarks: "",
      },
    ];
    setOrders((prev) => [...sample, ...prev]);
  }

  // Grouping function (broker + party)
  function groupByBrokerParty(list) {
    const map = {};
    list.forEach((o) => {
      const key = `${o.brokerName || "-"}||${o.partyName || "-"}`.toLowerCase();
      if (!map[key])
        map[key] = {
          key,
          broker: o.brokerName || "-",
          party: o.partyName || "-",
          items: [],
        };
      map[key].items.push(o);
    });
    const arr = Object.values(map).map((g) => {
      const totals = g.items.reduce(
        (acc, it) => {
          acc.total += parseFloat(it.quantity) || 0;
          acc.given += parseFloat(it.quantityGiven) || 0;
          return acc;
        },
        { total: 0, given: 0 }
      );
      totals.pending = Math.round((totals.total - totals.given) * 1000) / 1000;
      return { ...g, totals };
    });
    arr.sort((a, b) => b.totals.pending - a.totals.pending);
    return arr;
  }

  // Filtered and grouped views based on tab & filterText
  const salesGrouped = groupByBrokerParty(
    salesOrders.filter((o) =>
      (o.partyName + " " + o.brokerName)
        .toLowerCase()
        .includes(filterText.toLowerCase())
    )
  );
  const purchaseGrouped = groupByBrokerParty(
    purchaseOrders.filter((o) =>
      (o.partyName + " " + o.brokerName)
        .toLowerCase()
        .includes(filterText.toLowerCase())
    )
  );

  // Outstanding lists aggregated by party & commodity
  function outstandingByType(typeList) {
    const map = {};
    typeList.forEach((o) => {
      const key = `${o.partyName || "-"}||${o.commodity || "-"}`.toLowerCase();
      if (!map[key])
        map[key] = {
          party: o.partyName || "-",
          commodity: o.commodity || "-",
          total: 0,
          given: 0,
        };
      map[key].total += parseFloat(o.quantity) || 0;
      map[key].given += parseFloat(o.quantityGiven) || 0;
    });
    return Object.values(map)
      .map((x) => ({
        ...x,
        pending: Math.round((x.total - x.given) * 1000) / 1000,
      }))
      .sort((a, b) => b.pending - a.pending);
  }

  const salesOutstanding = outstandingByType(salesOrders);
  const purchaseOutstanding = outstandingByType(purchaseOrders);

  // Simple styles
  const btn = {
    padding: "8px 12px",
    marginRight: 8,
    borderRadius: 6,
    cursor: "pointer",
  };
  const primary = { background: "#0ea5a4", color: "#fff", border: "none" };
  const ghost = { background: "#f3f4f6", border: "1px solid #e5e7eb" };

  return (
    <div
      style={{
        fontFamily: "Inter, Roboto, Arial",
        padding: 18,
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>Kodhiyas Orders — Commodity Trade</h1>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <button
          style={{ ...btn, ...(tab === "sales" ? primary : ghost) }}
          onClick={() => setTab("sales")}
        >
          Sales Orders
        </button>
        <button
          style={{ ...btn, ...(tab === "purchase" ? primary : ghost) }}
          onClick={() => setTab("purchase")}
        >
          Purchase Orders
        </button>
        <button
          style={{ ...btn, ...(tab === "outstanding" ? primary : ghost) }}
          onClick={() => setTab("outstanding")}
        >
          Outstanding Report
        </button>
        <div style={{ marginLeft: "auto" }}>
          <input
            placeholder="Search buyer/broker"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ddd",
              width: 220,
            }}
          />
          <button style={{ ...btn, marginLeft: 8 }} onClick={addSampleData}>
            Add Sample
          </button>
          <button
            style={{ ...btn, marginLeft: 8 }}
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setOrders([]);
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Form area (shown on sales/purchase) */}
      {(tab === "sales" || tab === "purchase") && (
        <div
          style={{
            border: "1px solid #e6edf0",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12 }}>Buyer / Seller Name</label>
              <input
                value={form.partyName}
                onChange={(e) =>
                  setForm({ ...form, partyName: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ width: 200 }}>
              <label style={{ fontSize: 12 }}>Broker (optional)</label>
              <input
                value={form.brokerName}
                onChange={(e) =>
                  setForm({ ...form, brokerName: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ width: 200 }}>
              <label style={{ fontSize: 12 }}>Commodity</label>
              <select
                value={form.commodity}
                onChange={(e) =>
                  setForm({ ...form, commodity: e.target.value })
                }
                style={{ width: "100%", padding: 8, borderRadius: 6 }}
              >
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 12 }}>Quantity</label>
              <input
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 12 }}>Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 6 }}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 160 }}>
              <label style={{ fontSize: 12 }}>Quantity Given</label>
              <input
                value={form.quantityGiven}
                onChange={(e) =>
                  setForm({ ...form, quantityGiven: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 12 }}>Rate</label>
              <input
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12 }}>Remarks</label>
              <input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setForm({
                  ...form,
                  type: tab === "sales" ? "SALES" : "PURCHASE",
                });
                handleSave: null;
              }}
              style={{ ...btn, ...ghost }}
              onClickCapture={() =>
                setForm({
                  ...form,
                  type: tab === "sales" ? "SALES" : "PURCHASE",
                })
              }
            >
              Set Type
            </button>
            <button onClick={handleSave} style={{ ...btn, ...primary }}>
              {isEditing ? "Update" : "Save"} Order
            </button>
            <button
              onClick={() => {
                setForm(emptyForm);
                setIsEditing(false);
              }}
              style={{ ...btn, ...ghost }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Dashboard lists */}
      {tab === "sales" && (
        <div>
          <h3>Sales Dashboard</h3>
          {salesGrouped.length === 0 && (
            <div style={{ padding: 12, color: "#666" }}>
              No sales orders yet.
            </div>
          )}
          {salesGrouped.map((g, idx) => (
            <div
              key={g.key}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {g.party}{" "}
                    <span style={{ fontSize: 12, color: "#555" }}>
                      ({g.broker})
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#444" }}>
                    {g.items.length} orders
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>
                    Total: {g.totals.total} {g.items[0]?.unit || ""}
                  </div>
                  <div>Given: {g.totals.given}</div>
                  <div
                    style={{
                      color: g.totals.pending > 0 ? "#dc2626" : "#16a34a",
                    }}
                  >
                    Pending: {g.totals.pending}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      style={{ ...btn }}
                      onClick={() =>
                        setExpandedGroup(expandedGroup === g.key ? null : g.key)
                      }
                    >
                      {expandedGroup === g.key ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>
              </div>

              {expandedGroup === g.key && (
                <div style={{ marginTop: 10 }}>
                  {g.items.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: 8,
                        paddingBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {it.commodity} • {it.quantity} {it.unit}
                        </div>
                        <div style={{ color: "#555", fontSize: 13 }}>
                          {new Date(it.timestamp).toLocaleString()} — Given:{" "}
                          {it.quantityGiven} — Pending: {it.pending}
                        </div>
                        {it.remarks && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              color: "#444",
                            }}
                          >
                            Notes: {it.remarks}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <button
                          style={{ ...btn, ...ghost }}
                          onClick={() => editOrder(it.id)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...btn, ...ghost }}
                          onClick={() => handleDelete(it.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "purchase" && (
        <div>
          <h3>Purchase Dashboard</h3>
          {purchaseGrouped.length === 0 && (
            <div style={{ padding: 12, color: "#666" }}>
              No purchase orders yet.
            </div>
          )}
          {purchaseGrouped.map((g) => (
            <div
              key={g.key}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {g.party}{" "}
                    <span style={{ fontSize: 12, color: "#555" }}>
                      ({g.broker})
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#444" }}>
                    {g.items.length} orders
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>
                    Total: {g.totals.total} {g.items[0]?.unit || ""}
                  </div>
                  <div>Given: {g.totals.given}</div>
                  <div
                    style={{
                      color: g.totals.pending > 0 ? "#dc2626" : "#16a34a",
                    }}
                  >
                    Pending: {g.totals.pending}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      style={{ ...btn }}
                      onClick={() =>
                        setExpandedGroup(expandedGroup === g.key ? null : g.key)
                      }
                    >
                      {expandedGroup === g.key ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>
              </div>

              {expandedGroup === g.key && (
                <div style={{ marginTop: 10 }}>
                  {g.items.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: 8,
                        paddingBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {it.commodity} • {it.quantity} {it.unit}
                        </div>
                        <div style={{ color: "#555", fontSize: 13 }}>
                          {new Date(it.timestamp).toLocaleString()} — Given:{" "}
                          {it.quantityGiven} — Pending: {it.pending}
                        </div>
                        {it.remarks && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              color: "#444",
                            }}
                          >
                            Notes: {it.remarks}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <button
                          style={{ ...btn, ...ghost }}
                          onClick={() => editOrder(it.id)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...btn, ...ghost }}
                          onClick={() => handleDelete(it.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "outstanding" && (
        <div>
          <h3>Outstanding Report</h3>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4>Sales Outstanding</h4>
              {salesOutstanding.length === 0 && (
                <div style={{ color: "#666" }}>No pending sales</div>
              )}
              {salesOutstanding.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{s.party}</div>
                  <div style={{ fontSize: 13 }}>{s.commodity}</div>
                  <div>
                    Total: {s.total} • Given: {s.given} •{" "}
                    <span
                      style={{ color: s.pending > 0 ? "#dc2626" : "#16a34a" }}
                    >
                      Pending: {s.pending}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <h4>Purchase Outstanding</h4>
              {purchaseOutstanding.length === 0 && (
                <div style={{ color: "#666" }}>No pending purchases</div>
              )}
              {purchaseOutstanding.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{s.party}</div>
                  <div style={{ fontSize: 13 }}>{s.commodity}</div>
                  <div>
                    Total: {s.total} • Given: {s.given} •{" "}
                    <span
                      style={{ color: s.pending > 0 ? "#dc2626" : "#16a34a" }}
                    >
                      Pending: {s.pending}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 12, color: "#666" }}>
        Tip: Use "Add Sample" to populate demo data. All data is stored locally
        in your browser (localStorage).
      </div>
    </div>
  );
}
