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
    if (error) { setNotice(error.message); onMessage?.(error.message); } else { const note = action === "approve" ? "পেমেন্ট অনুমোদিত। ক্রেতার পেপার স্বয়ংক্রিয়ভাবে আনলক হয়েছে।" : "পেমেন্ট রিকোয়েস্ট Reject করা হয়েছে।"; setNotice(note); onMessage?.(note); }
    await refresh(); setBusyId("");
  }
  return <section className="panel editor-panel purchase-admin-panel">
    <div className="section-heading"><div><p className="eyebrow">PAPER SALES</p><h2>Paper Purchase History</h2></div><button className="secondary" onClick={refresh}>Refresh</button></div>
    <p className="muted">প্রতিটি ক্রেতার নাম, পেপারের তারিখ, মূল্য, bKash নম্বরের শেষ ৪ ডিজিট ও Approval Status এখানে দেখা যাবে। Approve করলে পেপার স্বয়ংক্রিয়ভাবে ক্রেতার কাছে দৃশ্যমান হবে।</p>
    {notice && <p className="notice">{notice}</p>}
    {loading ? <p>লোড হচ্ছে...</p> : rows.length === 0 ? <p className="muted">এখনো কোনো Purchase Request নেই।</p> : <div className="purchase-history-list">{rows.map(row => <article className="purchase-history-card" key={row.id}>
      <div className="purchase-history-top"><b>{row.customer_name}</b><span className={`purchase-status ${row.status}`}>{row.status === "approved" ? "COMPLETED" : row.status.toUpperCase()}</span></div>
      <div className="purchase-history-details"><span>Paper: <b>{row.paper_title || "Upcoming Paper"}</b></span><span>Paper Date: <b>{row.paper_date || "Not set"}</b></span><span>Price: <b>{money(row.amount_riyal)}</b></span><span>Payment Method: <b>{row.payment_method === "nagad" ? "Nagad" : "bKash"}</b></span><span>Sender Number Last 4: <b>{row.sender_last4}</b></span><span>Request: <b>{new Date(row.created_at).toLocaleString()}</b></span></div>
      {row.status === "pending" && <div className="purchase-actions"><button className="primary" disabled={busyId===row.id} onClick={()=>decide(row.id,"approve")}>Confirm Payment & Complete Order</button><button className="secondary" disabled={busyId===row.id} onClick={()=>decide(row.id,"reject")}>Reject</button></div>}
    </article>)}</div>}
  </section>;
}

export function PurchasePortal({ config }) {
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [trackingToken, setTrackingToken] = useState("");
  const [status, setStatus] = useState(null);
  const [paperUrl, setPaperUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const price = Number(config.paper_price_riyal || 125);
  const paymentNumber = paymentMethod === "nagad" ? (config.nagad_number || "Admin-এর Nagad নম্বর এখনো সেট করা হয়নি") : (config.bkash_number || "Admin-এর bKash নম্বর এখনো সেট করা হয়নি");
  const instructions = config.payment_instructions || "১. নিচের bKash নম্বরে নির্ধারিত টাকা Send Money করুন। ২. আপনার নাম ও প্রেরক নম্বরের শেষ ৪ ডিজিট দিয়ে আবেদন জমা দিন। ৩. Admin পেমেন্ট যাচাই করে Approve করলে পেপার স্বয়ংক্রিয়ভাবে দেখা যাবে।";

  async function checkStatus(token = trackingToken) {
    if (!token) return;
    const { data, error } = await supabase.rpc("get_paper_purchase_status", { p_tracking_token: token });
    if (error) { setMsg(error.message); return; }
    setStatus(data || null);
    if (data?.status === "approved") {
      const { data: unlocked, error: unlockError } = await supabase.functions.invoke("unlock-paper", { body: { tracking_token: token } });
      if (unlockError) { setMsg(unlockError.message || "পেপার দেখানো যায়নি।"); return; }
      if (unlocked?.signed_url) setPaperUrl(unlocked.signed_url);
      else setMsg(unlocked?.error || "অনুমোদিত পেপার লোড করা যায়নি।");
    } else {
      setPaperUrl("");
    }
  }
  useEffect(() => {
    try { const saved = localStorage.getItem("arian-paper-tracking-token"); if (saved) setTrackingToken(saved); } catch {}
  }, []);

  useEffect(() => {
    if (!trackingToken) return;
    checkStatus(trackingToken);
    const timer = setInterval(() => checkStatus(trackingToken), 8000);
    return () => clearInterval(timer);
  }, [trackingToken]);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const { data, error } = await supabase.rpc("submit_paper_purchase", {
        p_customer_name: name.trim(), p_sender_last4: last4, p_payment_method: paymentMethod, p_tracking_token: token
      });
      if (error) throw error;
      localStorage.setItem("arian-paper-tracking-token", token);
      setTrackingToken(token); await checkStatus(token);
      setMsg("আপনার পেমেন্ট রিকোয়েস্ট জমা হয়েছে। Admin যাচাই করে Approve করলে পেপার স্বয়ংক্রিয়ভাবে এখানে দেখা যাবে।");
      setName(""); setLast4(""); setPaymentMethod("bkash");
    } catch (err) { setMsg(err.message || "রিকোয়েস্ট জমা হয়নি।"); }
    finally { setBusy(false); }
  }


  return <section className="purchase-box">
    <div className="purchase-box-head"><span className="purchase-lock">🔒</span><div><p className="eyebrow">UPCOMING PAPER</p><h3>{config.purchase_title || "Buy Upcoming Paper"}</h3></div><strong className="purchase-price">{price} Riyal</strong></div>
    {config.upcoming_date && <p className="muted">Paper Date: {config.upcoming_date}</p>}
    <div className="payment-instructions"><b>Payment Instructions</b><p>{instructions}</p><div className="payment-method-choices"><button type="button" className={paymentMethod === "bkash" ? "payment-method active bkash" : "payment-method bkash"} onClick={()=>setPaymentMethod("bkash")}><span className="payment-wordmark">bKash</span><small>Send Money</small></button><button type="button" className={paymentMethod === "nagad" ? "payment-method active nagad" : "payment-method nagad"} onClick={()=>setPaymentMethod("nagad")}><span className="payment-wordmark">Nagad</span><small>Send Money</small></button></div><div className="bkash-number"><span>{paymentMethod === "nagad" ? "Nagad Send Money Number" : "bKash Send Money Number"}</span><b>{paymentNumber}</b></div></div>
    <form className="purchase-form" onSubmit={submit}>
      <label>Your Name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="আপনার নাম লিখুন"/></label>
      <label>{paymentMethod === "nagad" ? "Nagad" : "bKash"} Sender Number-এর শেষ ৪ ডিজিট<input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="1234"/></label>
      <button className="primary" disabled={busy}>{busy ? "Please wait..." : `Submit Payment Request · ${price} Riyal`}</button>
    </form>
    {trackingToken && <div className="purchase-status-area"><button className="secondary" type="button" onClick={()=>checkStatus()}>Check Payment Status</button>{status && <div className="purchase-status-card"><b>Order Status: {status.status === "approved" ? "COMPLETED" : status.status?.toUpperCase()}</b><p>Paper: {status.paper_title} · {status.paper_date || "Date not set"}</p><p>Price: {money(status.amount_riyal)} · Payment: {status.payment_method === "nagad" ? "Nagad" : "bKash"}</p>{status.status === "approved" && <div className="purchase-approved-note"><b>পেমেন্ট অনুমোদিত হয়েছে!</b><span>আপনার পেপার স্বয়ংক্রিয়ভাবে নিচে দেখানো হচ্ছে।</span></div>}{status.status === "rejected" && <p>পেমেন্ট অনুমোদিত হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।</p>}</div>}</div>}
    {paperUrl && <div className="unlocked-paper"><b>আপনার পেপার আনলক হয়েছে</b><a href={paperUrl} target="_blank" rel="noreferrer">পেপার বড় করে দেখুন / Open Paper</a><img src={paperUrl} alt="Purchased paper"/></div>}
    {msg && <p className="notice">{msg}</p>}
    <small className="purchase-disclaimer">পেমেন্ট Submit করলেই পেপার খুলবে না। Admin bKash/Nagad লেনদেন যাচাই করে Confirm করলেই আপনার পেপার স্বয়ংক্রিয়ভাবে দেখা যাবে। শুধু শেষ ৪ ডিজিট পেমেন্টের প্রমাণ নয়।</small>
  </section>;
}
