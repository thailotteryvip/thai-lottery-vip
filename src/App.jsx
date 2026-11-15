import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, CalendarClock, Check, CheckCircle2, ExternalLink,
  Eye, Globe, ImagePlus, Link2, LogOut, MessageCircle, RefreshCw, Save,
  Settings2, ShieldCheck, Star, Trash2, UploadCloud, X
} from "lucide-react";
import { isConfigured, supabase } from "./supabase";

const defaults = {
  title: "THAILAND LOTTERY SECRET MASTER PAPER",
  page_name: "Ariyan Chowdhury",
  profile_image: "",
  draw_at: "",
  upcoming_image: "",
  upcoming_date: "",
  previous_image: "",
  previous_date: "",
  result_text: "",
  official_url: "https://www.glo.or.th/",
  imo_url: "",
  notice: "তথ্য যাচাই করে নিন। এটি কোনো সরকারি লটারি সেবা বা জয়ের নিশ্চয়তা নয়।"
};

function App() {
  const [tab, setTab] = useState("admin");
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState(defaults);
  const [reviews, setReviews] = useState([]);
  const [draft, setDraft] = useState(defaults);
  const [reviewText, setReviewText] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewImage, setReviewImage] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState("");

  const configured = isConfigured;
  const viewerUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?view=1` : "";

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  async function loadData() {
    if (!configured) return;
    const { data: settings } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
    const next = { ...defaults, ...(settings?.data || {}) };
    setConfig(next);
    setDraft(next);
    const { data: rows } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
    setReviews(rows || []);
  }

  useEffect(() => {
    if (configured) loadData();
  }, [configured, session]);

  useEffect(() => {
    if (!configured) return;
    const channel = supabase.channel("public-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [configured]);

  useEffect(() => {
    const tick = () => {
      if (!config.draw_at) return setCountdown("তারিখ সেট করা হয়নি");
      const diff = new Date(config.draw_at).getTime() - Date.now();
      if (Number.isNaN(diff)) return setCountdown("সঠিক তারিখ দিন");
      if (diff <= 0) return setCountdown("ড্র-এর নির্ধারিত সময় পার হয়েছে");
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d} দিন  ${h} ঘণ্টা  ${m} মিনিট  ${s} সেকেন্ড`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.draw_at]);

  const params = new URLSearchParams(window.location.search);
  const isAdminRoute = params.get("admin") === "1";
  const isViewer = params.get("view") === "1" && !isAdminRoute;
  const pendingReviews = useMemo(() => reviews.filter(r => !r.approved), [reviews]);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    setMessage(error ? error.message : "লগইন সফল।");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function uploadImage(file, folder) {
    if (!file) return "";
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const path = `${folder}/${safeName}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("site-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function publish() {
    setBusy(true); setMessage("");
    try {
      const payload = { ...draft, published_at: new Date().toISOString() };
      const { error } = await supabase.from("site_settings").upsert({ id: 1, data: payload, updated_at: new Date().toISOString() });
      if (error) throw error;
      setConfig(payload);
      setMessage("পাবলিশ হয়েছে। Viewer লিংকে পরিবর্তন লাইভ হয়েছে।");
    } catch (e) { setMessage(e.message || "পাবলিশ করা যায়নি।"); }
    finally { setBusy(false); }
  }

  async function handleAsset(field, file) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const folder = field === "profile_image" ? "profile" : "papers";
      const url = await uploadImage(file, folder);
      setDraft(v => ({ ...v, [field]: url }));
      setMessage("ছবি আপলোড হয়েছে। পরিবর্তন লাইভ করতে Publish চাপুন।");
    } catch (e) { setMessage(e.message || "ছবি আপলোড হয়নি।"); }
    finally { setBusy(false); }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!configured) return;
    if (!reviewText.trim()) return setMessage("রিভিউ লিখুন।");
    setBusy(true); setMessage("");
    try {
      let image_url = "";
      if (reviewImage) image_url = await uploadImage(reviewImage, "reviews");
      const { error } = await supabase.from("reviews").insert({
        customer_name: reviewName.trim() || "নাম প্রকাশে অনিচ্ছুক",
        review_text: reviewText.trim(), image_url, approved: false
      });
      if (error) throw error;
      setReviewText(""); setReviewName(""); setReviewImage(null);
      setMessage("রিভিউ জমা হয়েছে। অ্যাডমিন অনুমোদনের পর প্রকাশিত হবে।");
    } catch (e) { setMessage(e.message || "রিভিউ জমা হয়নি।"); }
    finally { setBusy(false); }
  }

  async function moderateReview(id, approved) {
    const { error } = await supabase.from("reviews").update({ approved }).eq("id", id);
    setMessage(error ? error.message : approved ? "রিভিউ অনুমোদিত হয়েছে।" : "রিভিউ লুকানো হয়েছে।");
    loadData();
  }

  async function deleteReview(id) {
    if (!window.confirm("এই রিভিউটি স্থায়ীভাবে মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    setMessage(error ? error.message : "রিভিউ মুছে ফেলা হয়েছে।");
    loadData();
  }

  if (!configured) return <SetupGuide />;
  if (isViewer) return <Viewer config={config} countdown={countdown} reviews={reviews.filter(r => r.approved)} reviewText={reviewText} setReviewText={setReviewText} reviewName={reviewName} setReviewName={setReviewName} reviewImage={reviewImage} setReviewImage={setReviewImage} submitReview={submitReview} busy={busy} message={message} />;
  if (!session) return <main className="login-wrap"><a className="login-view-link" href={`${window.location.pathname}?view=1`}>← Viewer Website</a><form className="login-card" onSubmit={signIn}>
    <div className="brand-mark"><ShieldCheck size={25}/></div><p className="eyebrow">PRIVATE CONTROL CENTER</p>
    <h1>Admin Login</h1><p className="muted">Ariyan Chowdhury — Website Management</p>
    <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@example.com"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/></label>
    <button className="primary full" disabled={busy}> {busy ? "Signing in..." : "Login to Dashboard"} </button>
    {message && <p className="notice">{message}</p>}
  </form></main>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark"><ShieldCheck/></div><div><b>ARIYAN</b><small>CONTROL PANEL</small></div></div>
      <button className={tab==="admin"?"nav active":"nav"} onClick={()=>setTab("admin")}><Settings2 size={18}/> Website Editor</button>
      <button className={tab==="reviews"?"nav active":"nav"} onClick={()=>setTab("reviews")}><Star size={18}/> Customer Reviews <span className="count">{pendingReviews.length}</span></button>
      <button className="nav" onClick={()=>window.open(viewerUrl,"_blank")}><Eye size={18}/> View Website</button>
      <div className="side-bottom"><button className="nav" onClick={signOut}><LogOut size={18}/> Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="topbar"><div><p className="eyebrow">WEBSITE MANAGEMENT</p><h1>{tab==="admin"?"Dashboard":"Customer Reviews"}</h1></div><span className="live-pill"><i/> Connected</span></header>
      {tab==="admin" ? <div className="content-grid">
        <section className="panel editor-panel">
          <div className="section-heading"><div><p className="eyebrow">CONTENT SETTINGS</p><h2>Website Content</h2></div><span className="soft-icon"><Settings2/></span></div>
          <label>Headline<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <label>Facebook Page Name<input value={draft.page_name} onChange={e=>setDraft({...draft,page_name:e.target.value})}/></label>
          <ImageField title="Ariyan Chowdhury Profile Photo" url={draft.profile_image} onFile={f=>handleAsset("profile_image",f)} onRemove={()=>setDraft({...draft,profile_image:""})}/>
          <div className="field-grid">
            <label>Upcoming draw date & time<input type="datetime-local" value={draft.draw_at} onChange={e=>setDraft({...draft,draw_at:e.target.value})}/></label>
            <label>Upcoming paper date<input type="date" value={draft.upcoming_date} onChange={e=>setDraft({...draft,upcoming_date:e.target.value})}/></label>
          </div>
          <ImageField title="Upcoming Paper Image" url={draft.upcoming_image} onFile={f=>handleAsset("upcoming_image",f)} onRemove={()=>setDraft({...draft,upcoming_image:""})}/>
          <label>Previous draw date<input type="date" value={draft.previous_date} onChange={e=>setDraft({...draft,previous_date:e.target.value})}/></label>
          <ImageField title="Previous Winning Paper" url={draft.previous_image} onFile={f=>handleAsset("previous_image",f)} onRemove={()=>setDraft({...draft,previous_image:""})}/>
          <label>Previous game result<textarea rows="4" value={draft.result_text} onChange={e=>setDraft({...draft,result_text:e.target.value})} placeholder="ফলাফল এখানে লিখুন..."/></label>
          <label>Official lottery website URL<input type="url" value={draft.official_url} onChange={e=>setDraft({...draft,official_url:e.target.value})}/></label>
          <label>IMO contact link<input type="url" value={draft.imo_url} onChange={e=>setDraft({...draft,imo_url:e.target.value})} placeholder="https://..."/></label>
          <label>Notice / Disclaimer<textarea rows="2" value={draft.notice} onChange={e=>setDraft({...draft,notice:e.target.value})}/></label>
          <div className="publish-row"><button className="primary" onClick={publish} disabled={busy}><Save size={17}/>{busy?"Publishing...":"Publish Changes"}</button><span className="muted small">Publish করলেই Viewer Website-এ আপডেট যাবে</span></div>
          {message && <p className="notice">{message}</p>}
        </section>
        <section className="panel link-panel">
          <div className="section-heading"><div><p className="eyebrow">SHARE WITH VIEWERS</p><h2>Viewer Link</h2></div><span className="soft-icon"><Link2/></span></div>
          <p className="muted">এই লিংকটি ক্লায়েন্টদের পাঠাও। অনুমোদিত রিভিউ এখানে দেখা যাবে।</p>
          <div className="url-box"><span>{viewerUrl}</span><button onClick={()=>navigator.clipboard.writeText(viewerUrl)} title="Copy link"><Link2 size={17}/></button></div>
          <button className="secondary full" onClick={()=>window.open(viewerUrl,"_blank")}><ExternalLink size={16}/> Open Viewer Website</button>
          <div className="stat-card"><span className="stat-icon"><Star/></span><div><b>{reviews.length}</b><small>Total reviews received</small></div></div>
          <div className="stat-card"><span className="stat-icon amber"><Activity/></span><div><b>{pendingReviews.length}</b><small>Waiting for approval</small></div></div>
          <div className="hint"><ShieldCheck size={18}/><p>নতুন রিভিউ প্রথমে শুধু Admin Panel-এ আসবে। তুমি Approve করলে সেটি Viewer-এ প্রকাশিত হবে।</p></div>
        </section>
      </div> : <section className="panel reviews-panel">
        <div className="section-heading"><div><p className="eyebrow">MODERATION CENTER</p><h2>All Customer Reviews</h2></div><button className="secondary" onClick={loadData}><RefreshCw size={16}/> Refresh</button></div>
        {reviews.length===0 ? <div className="empty"><Star size={28}/><h3>No reviews yet</h3><p>Viewer link থেকে ক্লায়েন্টরা রিভিউ জমা দিতে পারবে।</p></div> :
          <div className="review-list">{reviews.map(r=><article className="review-item" key={r.id}>
            {r.image_url && <img className="review-thumb" src={r.image_url} alt="Customer upload"/>}
            <div className="review-body"><div className="review-meta"><b>{r.customer_name}</b><span className={r.approved?"approved":"pending"}>{r.approved?"Published":"Pending"}</span></div><p>{r.review_text}</p><small>{new Date(r.created_at).toLocaleString()}</small></div>
            <div className="review-actions">{!r.approved && <button className="icon-btn approve" onClick={()=>moderateReview(r.id,true)} title="Approve"><Check/></button>}<button className="icon-btn" onClick={()=>moderateReview(r.id,false)} title="Hide"><Eye/></button><button className="icon-btn danger" onClick={()=>deleteReview(r.id)} title="Delete"><Trash2/></button></div>
          </article>)}</div>}
        {message && <p className="notice">{message}</p>}
      </section>}
    </main>
  </div>;
}

function ImageField({title,url,onFile,onRemove}) {
  return <div className="upload-field"><div className="upload-head"><b>{title}</b>{url && <button className="text-btn" onClick={onRemove}><X size={14}/> Remove</button>}</div>
    {url ? <img className="paper-preview" src={url} alt={title}/> : <label className="upload-drop"><UploadCloud size={22}/><span>ছবি আপলোড করতে ক্লিক করুন</span><small>PNG, JPG বা WEBP</small><input type="file" accept="image/*" onChange={e=>onFile(e.target.files?.[0])}/></label>}
    {url && <label className="replace-link">ছবি পরিবর্তন করুন<input type="file" accept="image/*" onChange={e=>onFile(e.target.files?.[0])}/></label>}
  </div>;
}

function Viewer({config,countdown,reviews,reviewText,setReviewText,reviewName,setReviewName,reviewImage,setReviewImage,submitReview,busy,message}) {
  return <div className="viewer-page">
    <header className="viewer-top"><div className="viewer-brand">{config.profile_image ? <img className="profile-avatar" src={config.profile_image} alt={config.page_name}/> : <span className="brand-mark"><ShieldCheck/></span>}<div><b>{config.page_name}</b><small>COMMUNITY INFORMATION PAGE</small></div></div><a className="viewer-tag admin-entry" href={`${window.location.pathname}?admin=1`}>ADMIN LOGIN ↗</a></header>
    <section className="hero">
      <div className="hero-glow"/>
      <p className="eyebrow gold">INFORMATION & RESULTS</p><h1>{config.title}</h1><p className="hero-sub">Upcoming draw information · Previous paper · Result updates</p><div className="publisher-chip">{config.profile_image ? <img src={config.profile_image} alt=""/> : <span className="publisher-avatar"><ShieldCheck size={18}/></span>}<span><small>AUTHORIZED MASTER PUBLISHER</small><b>{config.page_name}</b></span></div>
      <div className="countdown-card"><div className="countdown-title"><CalendarClock size={18}/> UPCOMING DRAW COUNTDOWN</div><strong>{countdown || "Loading..."}</strong><small className="draw-date-label">{config.draw_at ? `Draw time: ${new Date(config.draw_at).toLocaleString()}` : "Draw date & time not published yet"}</small></div>
    </section>
    <main className="viewer-content">
      <section className="viewer-section"><div className="viewer-section-head"><div><p className="eyebrow">NEXT DRAW</p><h2>Upcoming Paper</h2></div><span className="section-number">01</span></div>
        <p className="muted">{config.upcoming_date ? `তারিখ: ${config.upcoming_date}` : "Upcoming draw paper"}</p>
        <Paper url={config.upcoming_image} label="Upcoming paper আপলোড করা হয়নি"/></section>
      <section className="viewer-section"><div className="viewer-section-head"><div><p className="eyebrow">LAST DRAW</p><h2>Previous Paper</h2></div><span className="section-number">02</span></div>
        <p className="muted">{config.previous_date ? `তারিখ: ${config.previous_date}` : "Previous draw paper"}</p>
        <Paper url={config.previous_image} label="Previous paper আপলোড করা হয়নি"/></section>
      <section className="viewer-section result-card"><div className="viewer-section-head"><div><p className="eyebrow">PUBLISHED INFORMATION</p><h2>Previous Game Result</h2></div><span className="section-number">03</span></div>
        <div className="result-text">{config.result_text || "সর্বশেষ ফলাফল এখনো প্রকাশ করা হয়নি।"}</div>
        <a className="primary link-button" href={config.official_url || "#"} target="_blank" rel="noreferrer">Check Official Result <ExternalLink size={16}/></a></section>
      <section className="official-strip"><Globe size={22}/><div><b>Thailand Lottery Official Website</b><small>সরকারি উৎস থেকে ফলাফল যাচাই করুন</small></div><a href={config.official_url || "#"} target="_blank" rel="noreferrer"><ArrowUpRight/></a></section>
      {config.imo_url && <a className="imo-button" href={config.imo_url} target="_blank" rel="noreferrer"><MessageCircle/> Contact on IMO</a>}
      <section className="viewer-section"><div className="viewer-section-head"><div><p className="eyebrow">COMMUNITY FEEDBACK</p><h2>Customer Reviews</h2></div><span className="section-number">04</span></div>
        <p className="muted">আপনার অভিজ্ঞতা শেয়ার করুন। রিভিউ যাচাই ও অনুমোদনের পর প্রকাশিত হবে।</p>
        <form className="review-form" onSubmit={submitReview}><label>Your name (optional)<input value={reviewName} onChange={e=>setReviewName(e.target.value)} placeholder="আপনার নাম"/></label>
          <label>Your review<textarea rows="4" required value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="আপনার অভিজ্ঞতা লিখুন..."/></label>
          <label className="upload-review"><ImagePlus size={19}/> {reviewImage ? reviewImage.name : "ছবি যুক্ত করুন (ঐচ্ছিক)"}<input type="file" accept="image/*" onChange={e=>setReviewImage(e.target.files?.[0]||null)}/></label>
          <button className="primary" disabled={busy}>{busy?"Submitting...":"Submit Review"}</button>{message && <p className="notice">{message}</p>}
        </form>
        <div className="public-reviews">{reviews.length===0 ? <p className="muted">এখনো কোনো অনুমোদিত রিভিউ নেই।</p> : reviews.map(r=><article className="public-review" key={r.id}>
          <div className="review-meta"><b>{r.customer_name}</b><span className="stars">★★★★★</span></div><p>{r.review_text}</p>{r.image_url && <img src={r.image_url} alt="Customer review attachment"/>}
        </article>)}</div>
      </section>
      <p className="disclaimer">{config.notice}</p>
    </main>
    <footer className="viewer-footer"><b>{config.page_name}</b><small>Independent information page · Not affiliated with the Thai Government Lottery Office</small></footer>
  </div>;
}

function Paper({url,label}) { return url ? <a href={url} target="_blank" rel="noreferrer"><img className="paper-image" src={url} alt="Lottery paper"/></a> : <div className="paper-empty"><ImagePlus size={28}/><span>{label}</span></div>; }

function SetupGuide() {
  return <main className="setup-wrap"><section className="setup-card"><div className="brand-mark"><ShieldCheck/></div><p className="eyebrow">PROJECT STARTER</p><h1>Admin Panel প্রস্তুত করার পরের ধাপ</h1>
    <p className="muted">এই প্যাকেজে Admin Panel, Viewer Website, live sync, image upload এবং review moderation-এর কোড আছে। অনলাইনে চালু করতে Supabase-এর ফ্রি প্রজেক্টের সঙ্গে যুক্ত করতে হবে।</p>
    <ol><li><b>Supabase project তৈরি করো</b><br/>supabase.com-এ গিয়ে Free project তৈরি করো।</li><li><b>SQL চালাও</b><br/><code>supabase/schema.sql</code> ফাইলের কোড SQL Editor-এ রান করো।</li><li><b>Environment variables বসাও</b><br/><code>.env.example</code> কপি করে <code>.env</code> বানাও; Project URL ও anon key বসাও।</li><li><b>Admin account তৈরি করো</b><br/>Supabase Authentication থেকে তোমার ইমেইল দিয়ে user তৈরি করো।</li><li><b>Deploy করো</b><br/>Vercel-এ project deploy করে একই environment variables যোগ করো।</li></ol>
    <div className="notice">নিরাপত্তা: Supabase service_role key কখনো ব্রাউজার বা .env-এর VITE_ ভেরিয়েবলে দেবে না। শুধু anon/public key ব্যবহার করবে।</div>
    <p className="muted small">সম্পূর্ণ ধাপ README.md ফাইলে দেওয়া আছে। সেটআপ না হওয়া পর্যন্ত কোনো পাবলিক Viewer URL তৈরি হবে না।</p>
  </section></main>;
}

export default App;
