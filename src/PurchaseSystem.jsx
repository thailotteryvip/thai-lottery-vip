import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";

const money = (n) => `${Number(n || 125).toLocaleString("en-US")} Riyal`;

export function AdminPurchases({ onMessage }) {
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from("paper_purchases").select("*").order("created_at", { ascending: false });
    if (error) { setNotice(error.message); onMessage?.(error.message); } else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);
  async function decide(id, action) {
    setBusyId(id);
    const { error } = await supabase.rpc(action === "approve" ? "admin_approve_paper_purchase" : "admin_reject_paper_purchase", { p_purchase_id: id });
    if (error) { setNotice(error.message); onMessage?.(error.message); } else { const note = action === "approve" ? "পেমেন্ট অনুমোদিত। Purchase Code তৈরি হয়েছে।" : "পেমেন্ট রিকোয়েস্ট Reject করা হয়েছে।"; setNotice(note); onMessage?.(note); }
    await refresh(); setBusyId("");
  }
  return <section className="panel editor-panel purchase-admin-panel">
    <div className="section-heading"><div><p className="eyebrow">PAPER SALES</p><h2>Paper Purchase History</h2></div><button className="secondary" onClick={refresh}>Refresh</button></div>
    <p className="muted">প্রতিটি ক্রেতার নাম, পেপারের তারিখ, মূল্য, bKash নম্বরের শেষ ৪ ডিজিট ও Approval Status এখানে দেখা যাবে। Approve করলে কোড স্বয়ংক্রিয়ভাবে তৈরি হবে।</p>
    {notice && <p className="notice">{notice}</p>}
    {loading ? <p>লোড হচ্ছে...</p> : rows.length === 0 ? <p className="muted">এখনো কোনো Purchase Request নেই।</p> : <div className="purchase-history-list">{rows.map(row => <article className="purchase-history-card" key={row.id}>
      <div className="purchase-history-top"><b>{row.customer_name}</b><span className={`purchase-status ${row.status}`}>{row.status}</span></div>
      <div className="purchase-history-details"><span>Paper: <b>{row.paper_title || "Upcoming Paper"}</b></span><span>Paper Date: <b>{row.paper_date || "Not set"}</b></span><span>Price: <b>{money(row.amount_riyal)}</b></span><span>bKash Last 4: <b>{row.sender_last4}</b></span><span>Request: <b>{new Date(row.created_at).toLocaleString()}</b></span></div>
      {row.status === "approved" && row.purchase_code && <div className="generated-code"><small>Generated Purchase Code</small><b>{row.purchase_code}</b></div>}
      {row.status === "pending" && <div className="purchase-actions"><button className="primary" disabled={busyId===row.id} onClick={()=>decide(row.id,"approve")}>Approve & Generate Code</button><button className="secondary" disabled={busyId===row.id} onClick={()=>decide(row.id,"reject")}>Reject</button></div>}
    </article>)}</div>}
  </section>;
}

export function PurchasePortal({ config }) {
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const price = Number(config.paper_price_riyal || 125);
  const paymentNumber = config.bkash_number || "Admin-এর bKash নম্বর এখনো সেট করা হয়নি";
  const instructions = config.payment_instructions || "১. নিচের bKash নম্বরে নির্ধারিত টাকা Send Money করুন। ২. আপনার নাম ও প্রেরক নম্বরের শেষ ৪ ডিজিট দিয়ে আবেদন জমা দিন। ৩. Admin পেমেন্ট যাচাই করে Approve করলে Purchase Code তৈরি হবে।";

  async function checkStatus(token = trackingToken) {
    if (!token) return;
    const { data, error } = await supabase.rpc("get_paper_purchase_status", { p_tracking_token: token });
    if (error) { setMsg(error.message); return; }
    setStatus(data || null);
  }
  useEffect(() => {
    try { const saved = localStorage.getItem("arian-paper-tracking-token"); if (saved) { setTrackingToken(saved); checkStatus(saved); } } catch {}
  }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const { data, error } = await supabase.rpc("submit_paper_purchase", {
        p_customer_name: name.trim(), p_sender_last4: last4, p_tracking_token: token
      });
      if (error) throw error;
      localStorage.setItem("arian-paper-tracking-token", token);
      setTrackingToken(token); await checkStatus(token);
      setMsg("আপনার পেমেন্ট রিকোয়েস্ট জমা হয়েছে। Admin যাচাই করে Approve করলে এখানেই Purchase Code দেখাবে।");
      setName(""); setLast4("");
    } catch (err) { setMsg(err.message || "রিকোয়েস্ট জমা হয়নি।"); }
    finally { setBusy(false); }
  }

  async function unlock(e) {
    e.preventDefault(); setBusy(true); setMsg(""); setPaperUrl("");
    try {
      const { data, error } = await supabase.functions.invoke("unlock-paper", { body: { purchase_code: code.trim() } });
      if (error) throw error;
      if (!data?.signed_url) throw new Error(data?.error || "কোড যাচাই করা যায়নি।");
      setPaperUrl(data.signed_url);
    } catch (err) { setMsg(err.message || "পেপার আনলক করা যায়নি।"); }
    finally { setBusy(false); }
  }

  return <section className="purchase-box">
    <div className="purchase-box-head"><span className="purchase-lock">🔒</span><div><p className="eyebrow">UPCOMING PAPER</p><h3>{config.purchase_title || "Buy Upcoming Paper"}</h3></div><strong className="purchase-price">{price} Riyal</strong></div>
    {config.upcoming_date && <p className="muted">Paper Date: {config.upcoming_date}</p>}
    <div className="payment-instructions"><b>Payment Instructions</b><p>{instructions}</p><div className="bkash-number"><span>bKash Send Money</span><b>{paymentNumber}</b></div></div>
    <form className="purchase-form" onSubmit={submit}>
      <label>Your Name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="আপনার নাম লিখুন"/></label>
      <label>bKash Sender Number-এর শেষ ৪ ডিজিট<input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234"/></label>
      <button className="primary" disabled={busy}>{busy ? "Please wait..." : `Submit Payment Request · ${price} Riyal`}</button>
    </form>
    {trackingToken && <div className="purchase-status-area"><button className="secondary" type="button" onClick={()=>checkStatus()}>Check Payment Status</button>{status && <div className="purchase-status-card"><b>Purchase Request: {status.status?.toUpperCase()}</b><p>Paper: {status.paper_title} · {status.paper_date || "Date not set"}</p><p>Price: {money(status.amount_riyal)}</p>{status.status === "approved" && status.purchase_code && <div className="generated-code"><small>Your Automatically Generated Purchase Code</small><b>{status.purchase_code}</b><span>এই কোডটি নিচের Unlock ফর্মে বসান।</span></div>}{status.status === "rejected" && <p>পেমেন্ট অনুমোদিত হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।</p>}</div>}</div>}
    <form className="purchase-form unlock-form" onSubmit={unlock}><label>Enter Purchase Code<input required value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="আপনার Purchase Code"/></label><button className="secondary" disabled={busy}>UNLOCK PAPER</button></form>
    {paperUrl && <div className="unlocked-paper"><b>আপনার পেপার আনলক হয়েছে</b><a href={paperUrl} target="_blank" rel="noreferrer">পেপার বড় করে দেখুন / Open Paper</a><img src={paperUrl} alt="Purchased paper"/></div>}
    {msg && <p className="notice">{msg}</p>}
    <small className="purchase-disclaimer">পেমেন্ট Submit করলেই পেপার খুলবে না। Admin লেনদেন যাচাই করে Approve করার পরই কোড তৈরি হবে। শুধু শেষ ৪ ডিজিট পেমেন্টের প্রমাণ নয়।</small>
  </section>;
}
