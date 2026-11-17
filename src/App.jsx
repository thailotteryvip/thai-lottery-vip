import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, CalendarClock, Check, CheckCircle2, ExternalLink,
  Eye, Globe, ImagePlus, Link2, LogOut, MessageCircle, RefreshCw, Save,
  Settings2, ShieldCheck, Star, Trash2, UploadCloud, X
} from "lucide-react";
import { isConfigured, supabase } from "./supabase";
import { AdminPurchases, PurchasePortal } from "./PurchaseSystem";

const defaults = {
  title: "THAILAND LOTTERY SECRET MASTER PAPER",
  page_name: "Ariyan Chowdhury",
  profile_image: "",
  header_profile_image: "",
  brand_title: "THAILAND LOTTERY",
  brand_subtitle: "INFORMATION PORTAL",
  hero_subtitle: "Upcoming draw information · Previous paper · Result updates",
  publisher_label: "AUTHORIZED MASTER PUBLISHER",
  publisher_name: "Ariyan Chowdhury",
  video_caption: "ভিডিওটি এখানে সরাসরি দেখা যাবে।",
  footer_custom_text: "",
  draw_at: "",
  upcoming_image: "",
  upcoming_date: "",
  previous_image: "",
  previous_date: "",
  video_proof_url: "",
  result_text: "",
  official_url: "https://www.glo.or.th/",
  imo_url: "",
  notice: "তথ্য যাচাই করে নিন। এটি কোনো সরকারি লটারি সেবা বা জয়ের নিশ্চয়তা নয়।",
  show_reviews: true,
  section_order: ["upcoming", "previous", "result", "video", "official", "imo", "reviews"],
  section_visibility: { upcoming: true, previous: true, result: true, video: true, official: true, imo: true, reviews: true },
  viewer_font_size: 16,
  viewer_bold: false,
  countdown_font_size: 30,
  countdown_bold: true,
  countdown_label_size: 11,
  countdown_labels: { days: "DAYS", hours: "HOURS", minutes: "MINUTES", seconds: "SECONDS" },
  paper_price_riyal: 125, purchase_title: "Buy Upcoming Paper", bkash_number: "", nagad_number: "", payment_instructions: "১. নির্ধারিত bKash নম্বরে Send Money করুন। ২. আপনার নাম ও প্রেরক নম্বরের শেষ ৪ ডিজিট দিয়ে আবেদন জমা দিন। ৩. Admin যাচাই করে Approve করলে পেপার স্বয়ংক্রিয়ভাবে দেখা যাবে।", upcoming_private_path: ""
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
  const adminUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?admin=1` : "";

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
      if (!config.draw_at) return setCountdown("00 : 00 : 00 : 00");
      const diff = new Date(config.draw_at).getTime() - Date.now();
      if (Number.isNaN(diff)) return setCountdown("00 : 00 : 00 : 00");
      if (diff <= 0) return setCountdown("00 : 00 : 00 : 00");
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(d).padStart(2,"0")} : ${String(h).padStart(2,"0")} : ${String(m).padStart(2,"0")} : ${String(s).padStart(2,"0")}`);
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

  async function uploadVideo(file) {
    if (!file) return;
    const mime = file.type || (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : file.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : file.name.toLowerCase().endsWith('.webm') ? 'video/webm' : '');
    if (!mime.startsWith("video/")) throw new Error("শুধু MP4, WEBM বা MOV ভিডিও ফাইল আপলোড করুন।");
    if (file.size > 100 * 1024 * 1024) throw new Error("ভিডিও সর্বোচ্চ 100 MB হতে পারবে।");
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const path = `video-proof/${safeName}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: false, contentType: mime });
    if (error) throw error;
    const { data } = supabase.storage.from("site-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleVideoProof(file) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const url = await uploadVideo(file);
      setDraft(v => ({ ...v, video_proof_url: url }));
      setMessage("ভিডিও আপলোড হয়েছে। ওয়েবসাইটে দেখাতে Publish চাপুন।");
    } catch (e) { setMessage(e.message || "ভিডিও আপলোড হয়নি।"); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (draft.result_text && !/^\d{3}$/.test(draft.result_text)) return setMessage("Live Result-এ ঠিক ৩টি সংখ্যা লিখুন।");
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
      const folder = field.includes("profile") ? "profile" : "papers";
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
      <button className={tab==="purchases"?"nav active":"nav"} onClick={()=>setTab("purchases")}><ShieldCheck size={18}/> Paper Purchases</button>
      <button className="nav" onClick={()=>window.open(viewerUrl,"_blank")}><Eye size={18}/> View Website</button>
      <div className="side-bottom"><button className="nav" onClick={signOut}><LogOut size={18}/> Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="topbar"><div><p className="eyebrow">WEBSITE MANAGEMENT</p><h1>{tab==="admin"?"Dashboard":tab==="purchases"?"Paper Purchase History":"Customer Reviews"}</h1></div><span className="live-pill"><i/> Connected</span></header>
      {tab==="purchases" ? <AdminPurchases onMessage={setMessage}/> : tab==="admin" ? <div className="content-grid">
        <section className="panel editor-panel">
          <div className="section-heading"><div><p className="eyebrow">CONTENT SETTINGS</p><h2>Website Content</h2></div><span className="soft-icon"><Settings2/></span></div>
          <label>Main Headline / Website Title<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <label>Facebook Page Name<input value={draft.page_name} onChange={e=>setDraft({...draft,page_name:e.target.value})}/></label>
          <div className="editor-subheading"><b>Header & Profile Customization</b><small>ওয়েবসাইটের উপরের ব্র্যান্ড লেখা ও দুইটি আলাদা প্রোফাইল ছবি এখান থেকে বদলাও।</small></div>
          <label>Header Main Text<input value={draft.brand_title} onChange={e=>setDraft({...draft,brand_title:e.target.value})}/></label>
          <label>Header Small Text<input value={draft.brand_subtitle} onChange={e=>setDraft({...draft,brand_subtitle:e.target.value})}/></label>
          <ImageField title="Header-এর পাশে আলাদা Profile Photo" url={draft.header_profile_image} onFile={f=>handleAsset("header_profile_image",f)} onRemove={()=>setDraft({...draft,header_profile_image:""})}/>
          <ImageField title="Authorized Publisher Profile Photo" url={draft.profile_image} onFile={f=>handleAsset("profile_image",f)} onRemove={()=>setDraft({...draft,profile_image:""})}/>
          <label>Hero Section-এর নিচের লেখা<input value={draft.hero_subtitle} onChange={e=>setDraft({...draft,hero_subtitle:e.target.value})}/></label>
          <label>Publisher পরিচয়ের উপরের লেখা<input value={draft.publisher_label} onChange={e=>setDraft({...draft,publisher_label:e.target.value})}/></label>
          <label>Publisher Name<input value={draft.publisher_name} onChange={e=>setDraft({...draft,publisher_name:e.target.value})}/></label>
          <div className="editor-subheading"><b>অন্যান্য লেখা পরিবর্তন</b><small>ভিডিও অংশ ও Footer-এর লেখা নিজের মতো করে লিখতে পারবে।</small></div>
          <label>Video Proof-এর নিচের লেখা<input value={draft.video_caption} onChange={e=>setDraft({...draft,video_caption:e.target.value})}/></label>
          <label>Footer-এর অতিরিক্ত লেখা<input value={draft.footer_custom_text} onChange={e=>setDraft({...draft,footer_custom_text:e.target.value})}/></label>
          <div className="editor-subheading"><b>লেখার সাইজ ও Bold কন্ট্রোল</b><small>Viewer Website-এর সাধারণ লেখার সাইজ ও Bold চালু/বন্ধ করো। কাউন্টডাউনের সংখ্যা ও নিচের লেবেলের সাইজ আলাদাভাবে ঠিক করতে পারবে।</small></div>
          <label>সাধারণ লেখার সাইজ: {draft.viewer_font_size || 16}px<input type="range" min="12" max="24" value={draft.viewer_font_size || 16} onChange={e=>setDraft({...draft,viewer_font_size:Number(e.target.value)})}/></label>
          <label className="toggle-setting"><input type="checkbox" checked={draft.viewer_bold === true} onChange={e=>setDraft({...draft,viewer_bold:e.target.checked})}/> <span><b>সব সাধারণ লেখা Bold</b><small>চালু করলে Viewer Website-এর লেখাগুলো Bold হবে।</small></span></label>
          <label>কাউন্টডাউন সংখ্যার সাইজ: {draft.countdown_font_size || 30}px<input type="range" min="18" max="56" value={draft.countdown_font_size || 30} onChange={e=>setDraft({...draft,countdown_font_size:Number(e.target.value)})}/></label>
          <label className="toggle-setting"><input type="checkbox" checked={draft.countdown_bold !== false} onChange={e=>setDraft({...draft,countdown_bold:e.target.checked})}/> <span><b>কাউন্টডাউন সংখ্যা Bold</b><small>ইচ্ছামতো Bold চালু বা বন্ধ করো।</small></span></label>
          <label>কাউন্টডাউনের নিচের লেবেলের সাইজ: {draft.countdown_label_size || 11}px<input type="range" min="9" max="20" value={draft.countdown_label_size || 11} onChange={e=>setDraft({...draft,countdown_label_size:Number(e.target.value)})}/></label>
          <div className="field-grid">
            <label>Days লেখা<input value={(draft.countdown_labels || defaults.countdown_labels).days} onChange={e=>setDraft({...draft,countdown_labels:{...(draft.countdown_labels || defaults.countdown_labels),days:e.target.value}})}/></label>
            <label>Hours লেখা<input value={(draft.countdown_labels || defaults.countdown_labels).hours} onChange={e=>setDraft({...draft,countdown_labels:{...(draft.countdown_labels || defaults.countdown_labels),hours:e.target.value}})}/></label>
            <label>Minutes লেখা<input value={(draft.countdown_labels || defaults.countdown_labels).minutes} onChange={e=>setDraft({...draft,countdown_labels:{...(draft.countdown_labels || defaults.countdown_labels),minutes:e.target.value}})}/></label>
            <label>Seconds লেখা<input value={(draft.countdown_labels || defaults.countdown_labels).seconds} onChange={e=>setDraft({...draft,countdown_labels:{...(draft.countdown_labels || defaults.countdown_labels),seconds:e.target.value}})}/></label>
          </div>
          <div className="editor-subheading"><b>Viewer Website Section Control</b><small>প্রতিটি অংশের Show/Hide চালু বা বন্ধ করো। ▲ ▼ বোতাম দিয়ে কোন অংশের পর কোন অংশ থাকবে সাজাও। বন্ধ করা অংশ ভিজিটর পেজে দেখা যাবে না; আবার চালু করলে ফিরে আসবে।</small></div>
          <div className="section-order-list">
            {(draft.section_order || defaults.section_order).map((key, index) => {
              const names = {upcoming:"Upcoming Paper",previous:"Previous Paper",result:"Live Result",video:"Client Service Video Proof",official:"Thailand Lottery Official Website",imo:"IMO Contact",reviews:"Customer Reviews"};
              const visibility = { ...defaults.section_visibility, ...(draft.section_visibility || {}) };
              return <div className="section-order-row" key={key}><span className="order-index">{index + 1}</span><b>{names[key] || key}</b><label className="section-visibility-toggle"><input type="checkbox" checked={visibility[key] !== false} onChange={e=>setDraft({...draft,section_visibility:{...visibility,[key]:e.target.checked}})}/><span>{visibility[key] !== false ? "Show" : "Hidden"}</span></label><div className="order-actions"><button type="button" aria-label="Move section up" disabled={index===0} onClick={()=>{const a=[...(draft.section_order||defaults.section_order)];[a[index-1],a[index]]=[a[index],a[index-1]];setDraft({...draft,section_order:a});}}>▲</button><button type="button" aria-label="Move section down" disabled={index===((draft.section_order||defaults.section_order).length-1)} onClick={()=>{const a=[...(draft.section_order||defaults.section_order)];[a[index+1],a[index]]=[a[index],a[index+1]];setDraft({...draft,section_order:a});}}>▼</button></div></div>;
            })}
          </div>
          <div className="field-grid">
            <label>Upcoming draw date & time<input type="datetime-local" value={draft.draw_at} onChange={e=>setDraft({...draft,draw_at:e.target.value})}/></label>
            <label>Upcoming paper date<input type="date" value={draft.upcoming_date} onChange={e=>setDraft({...draft,upcoming_date:e.target.value})}/></label>
          </div>
          <div className="editor-subheading"><b>Paid Upcoming Paper Purchase</b><small>পেপারটি Private Bucket-এ আপলোড হবে। ক্রেতা Admin পেমেন্ট Approve করলেই ক্রেতার পেপার স্বয়ংক্রিয়ভাবে দেখা যাবে।</small></div>
          <label>Paper Price (Riyal)<input type="number" min="1" step="0.01" value={draft.paper_price_riyal || 125} onChange={e=>setDraft({...draft,paper_price_riyal:Number(e.target.value)})}/></label>
          <label>Purchase Section Title<input value={draft.purchase_title || "Buy Upcoming Paper"} onChange={e=>setDraft({...draft,purchase_title:e.target.value})}/></label>
          <div className="field-grid"><label>bKash Send Money Number<input value={draft.bkash_number || ""} onChange={e=>setDraft({...draft,bkash_number:e.target.value})} placeholder="01XXXXXXXXX"/></label><label>Nagad Send Money Number<input value={draft.nagad_number || ""} onChange={e=>setDraft({...draft,nagad_number:e.target.value})} placeholder="01XXXXXXXXX"/></label></div>
          <label>Payment Instructions<textarea rows="4" value={draft.payment_instructions || ""} onChange={e=>setDraft({...draft,payment_instructions:e.target.value})}/></label>
          <PrivatePaperField path={draft.upcoming_private_path} onFile={async file=>{if(!file)return;setBusy(true);setMessage("");try{if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("শুধু JPG, PNG, WEBP বা PDF দিন।");const path=`upcoming/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;const {error}=await supabase.storage.from("paper-private").upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;setDraft(v=>({...v,upcoming_private_path:path,upcoming_image:""}));setMessage("Private Upcoming Paper আপলোড হয়েছে। Publish Changes চাপুন।");}catch(e){setMessage(e.message||"আপলোড হয়নি");}finally{setBusy(false);}}} onRemove={()=>setDraft({...draft,upcoming_private_path:""})}/>
          <small className="field-help">Paid Purchase System চালু রাখতে Upcoming Paper এখানে Private হিসেবে আপলোড করো। নিচের পুরোনো Upcoming Paper Image ফিল্ডটি শুধু ফ্রি/পাবলিক পেপারের জন্য।</small>
          <ImageField title="Upcoming Paper Image (Public / Free Paper only)" url={draft.upcoming_image} onFile={f=>handleAsset("upcoming_image",f)} onRemove={()=>setDraft({...draft,upcoming_image:""})}/>
          <label>Previous draw date<input type="date" value={draft.previous_date} onChange={e=>setDraft({...draft,previous_date:e.target.value})}/></label>
          <ImageField title="Previous Winning Paper" url={draft.previous_image} onFile={f=>handleAsset("previous_image",f)} onRemove={()=>setDraft({...draft,previous_image:""})}/>
          <VideoProofField url={draft.video_proof_url} onFile={handleVideoProof} onRemove={()=>setDraft({...draft,video_proof_url:""})}/>
          <label>Live Result (৩ সংখ্যার ফলাফল)<input type="text" inputMode="numeric" maxLength={3} pattern="[0-9]{3}" value={draft.result_text} onChange={e=>setDraft({...draft,result_text:e.target.value.replace(/\D/g, "").slice(0,3)})} placeholder="যেমন: 012"/><small className="field-help">ইংরেজি সংখ্যায় ঠিক ৩টি ডিজিট লিখবে। শুরুতে 0 থাকলেও সেটি ঠিক থাকবে।</small></label>
          <label>Official lottery website URL<input type="url" value={draft.official_url} onChange={e=>setDraft({...draft,official_url:e.target.value})}/></label>
          <label>IMO contact link<input type="url" value={draft.imo_url} onChange={e=>setDraft({...draft,imo_url:e.target.value})} placeholder="https://..."/></label>
          <label>Notice / Disclaimer<textarea rows="2" value={draft.notice} onChange={e=>setDraft({...draft,notice:e.target.value})}/></label>
          <label className="toggle-setting"><input type="checkbox" checked={draft.show_reviews !== false} onChange={e=>setDraft({...draft,show_reviews:e.target.checked})}/> <span><b>Show Customer Reviews section</b><small>বন্ধ করলে Viewer Website থেকে পুরো Review অংশ লুকানো থাকবে।</small></span></label>
          <div className="publish-row"><button className="primary" onClick={publish} disabled={busy}><Save size={17}/>{busy?"Publishing...":"Publish Changes"}</button><span className="muted small">Publish করলেই Viewer Website-এ আপডেট যাবে</span></div>
          {message && <p className="notice">{message}</p>}
        </section>
        <section className="panel link-panel">
          <div className="section-heading"><div><p className="eyebrow">SHARE WITH VIEWERS</p><h2>Viewer Link</h2></div><span className="soft-icon"><Link2/></span></div>
          <p className="muted">এই লিংকটি ক্লায়েন্টদের পাঠাও। অনুমোদিত রিভিউ এখানে দেখা যাবে।</p>
          <div className="url-box"><span>{viewerUrl}</span><button onClick={()=>navigator.clipboard.writeText(viewerUrl)} title="Copy link"><Link2 size={17}/></button></div>
          <button className="secondary full" onClick={()=>window.open(viewerUrl,"_blank")}><ExternalLink size={16}/> Open Viewer Website</button>
          <div className="admin-url-block"><b>Private Admin Login Link</b><p className="muted small">এই লিংকটি শুধু নিজের কাছে রাখবে; কাউকে শেয়ার করবে না। লগইনের জন্য Supabase account লাগবে।</p><div className="url-box"><span>{adminUrl}</span><button onClick={()=>navigator.clipboard.writeText(adminUrl)} title="Copy admin link"><Link2 size={17}/></button></div></div>
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


function PrivatePaperField({path,onFile,onRemove}) {
  return <div className="upload-field"><div className="upload-head"><b>Private Upcoming Paper (Paid Access)</b>{path && <button className="text-btn" type="button" onClick={onRemove}><X size={14}/> Remove</button>}</div>{path ? <div className="private-paper-ready"><ShieldCheck size={24}/><span>Private Paper uploaded: <b>{path.split("/").pop()}</b></span></div> : <label className="upload-drop"><UploadCloud size={22}/><span>Private Upcoming Paper আপলোড করুন</span><small>JPG / PNG / WEBP · সর্বোচ্চ 50 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>onFile(e.target.files?.[0])}/></label>}</div>;
}

function VideoProofField({url,onFile,onRemove}) {
  return <div className="upload-field video-upload-field"><div className="upload-head"><b>Client Service Video Proof</b>{url && <button className="text-btn" onClick={onRemove}><X size={14}/> Remove</button>}</div>
    {url ? <><video className="admin-video-preview" src={url} controls playsInline/><label className="replace-link">ভিডিও পরিবর্তন করুন<input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={e=>onFile(e.target.files?.[0])}/></label></> : <label className="upload-drop"><UploadCloud size={22}/><span>ক্লায়েন্ট সার্ভিসের ভিডিও প্রুফ আপলোড করুন</span><small>MP4 / WEBM / MOV · সর্বোচ্চ 100 MB</small><input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={e=>onFile(e.target.files?.[0])}/></label>}
    <small className="field-help">ভিডিও আপলোডের পর Publish Changes চাপলে Viewer Website-এ দেখা যাবে।</small>
  </div>;
}

function ImageField({title,url,onFile,onRemove}) {
  return <div className="upload-field"><div className="upload-head"><b>{title}</b>{url && <button className="text-btn" onClick={onRemove}><X size={14}/> Remove</button>}</div>
    {url ? <img className="paper-preview" src={url} alt={title}/> : <label className="upload-drop"><UploadCloud size={22}/><span>ছবি আপলোড করতে ক্লিক করুন</span><small>PNG, JPG বা WEBP</small><input type="file" accept="image/*" onChange={e=>onFile(e.target.files?.[0])}/></label>}
    {url && <label className="replace-link">ছবি পরিবর্তন করুন<input type="file" accept="image/*" onChange={e=>onFile(e.target.files?.[0])}/></label>}
  </div>;
}

function Viewer({config,countdown,reviews,reviewText,setReviewText,reviewName,setReviewName,reviewImage,setReviewImage,submitReview,busy,message}) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("ariyan-language") || "en"; } catch { return "en"; }
  });
  const t = {
    en: {tag:"INDEPENDENT LOTTERY INFORMATION",sub:"Upcoming draw information · Previous paper · Result updates",countdown:"NEXT DRAW COUNTDOWN",draw:"Draw time",notSet:"Draw date & time not published yet",upcoming:"Upcoming Paper",previous:"Previous Paper",date:"Date",paperMissing:"Paper image has not been uploaded",latest:"LATEST UPDATE",live:"Live Result",result:"3 DIGIT RESULT",published:"Latest published result",notPublished:"Result has not been published yet",check:"Check Official Result",official:"Thailand Lottery Official Website",verify:"Please verify results with the official source",reviews:"Customer Reviews",feedback:"COMMUNITY FEEDBACK",reviewIntro:"Share your experience. Reviews are published after moderation.",name:"Your name (optional)",yourReview:"Your review",namePlaceholder:"Your name",reviewPlaceholder:"Write your experience...",addImage:"Add an image (optional)",submit:"Submit Review",submitting:"Submitting...",noReviews:"No approved reviews yet.",serviceProof:"CLIENT SERVICE VIDEO PROOF",drawInfo:"NEXT DRAW",last:"LAST DRAW",publisher:"AUTHORIZED MASTER PUBLISHER",contact:"Contact on IMO",footer:"Independent information page · Not affiliated with the Thai Government Lottery Office",days:"DAYS · HOURS · MINUTES · SECONDS"},
    bn: {tag:"স্বাধীন লটারি তথ্যসেবা",sub:"আসন্ন ড্র · পূর্ববর্তী পেপার · ফলাফল আপডেট",countdown:"পরবর্তী ড্র-এর কাউন্টডাউন",draw:"ড্র-এর সময়",notSet:"ড্র-এর তারিখ ও সময় এখনো দেওয়া হয়নি",upcoming:"আসন্ন পেপার",previous:"পূর্ববর্তী পেপার",date:"তারিখ",paperMissing:"পেপারের ছবি আপলোড করা হয়নি",latest:"সর্বশেষ আপডেট",live:"লাইভ রেজাল্ট",result:"৩ সংখ্যার ফলাফল",published:"সর্বশেষ প্রকাশিত ফলাফল",notPublished:"ফলাফল এখনো প্রকাশ করা হয়নি",check:"অফিশিয়াল ফলাফল দেখুন",official:"থাইল্যান্ড লটারি অফিসিয়াল ওয়েবসাইট",verify:"অফিশিয়াল উৎস থেকে ফলাফল যাচাই করুন",reviews:"কাস্টমার রিভিউ",feedback:"গ্রাহকদের মতামত",reviewIntro:"আপনার অভিজ্ঞতা জানান। যাচাইয়ের পর রিভিউ প্রকাশিত হবে।",name:"আপনার নাম (ঐচ্ছিক)",yourReview:"আপনার রিভিউ",namePlaceholder:"আপনার নাম",reviewPlaceholder:"আপনার অভিজ্ঞতা লিখুন...",addImage:"ছবি যুক্ত করুন (ঐচ্ছিক)",submit:"রিভিউ জমা দিন",submitting:"জমা হচ্ছে...",noReviews:"এখনো কোনো অনুমোদিত রিভিউ নেই।",serviceProof:"ক্লায়েন্ট সার্ভিসের ভিডিও প্রুফ",drawInfo:"পরবর্তী ড্র",last:"সর্বশেষ ড্র",publisher:"অনুমোদিত মাস্টার পাবলিশার",contact:"IMO-তে যোগাযোগ",footer:"স্বাধীন তথ্য পেজ · থাই সরকারি লটারি অফিসের সঙ্গে অনুমোদিত বা সম্পৃক্ত নয়",days:"দিন · ঘণ্টা · মিনিট · সেকেন্ড"},
    th: {tag:"ศูนย์ข้อมูลลอตเตอรี่แบบอิสระ",sub:"งวดถัดไป · เอกสารงวดก่อน · อัปเดตผลรางวัล",countdown:"นับถอยหลังงวดถัดไป",draw:"เวลาออกรางวัล",notSet:"ยังไม่ได้ประกาศวันและเวลาออกรางวัล",upcoming:"เอกสารงวดถัดไป",previous:"เอกสารงวดก่อน",date:"วันที่",paperMissing:"ยังไม่ได้อัปโหลดภาพเอกสาร",latest:"อัปเดตล่าสุด",live:"ผลรางวัลล่าสุด",result:"ผลลัพธ์ 3 หลัก",published:"ผลรางวัลที่ประกาศล่าสุด",notPublished:"ยังไม่มีการประกาศผลรางวัล",check:"ตรวจสอบผลอย่างเป็นทางการ",official:"เว็บไซต์สำนักงานสลากกินแบ่งรัฐบาลไทย",verify:"โปรดตรวจสอบผลจากแหล่งข้อมูลทางการ",reviews:"รีวิวจากลูกค้า",feedback:"ความคิดเห็นจากชุมชน",reviewIntro:"แบ่งปันประสบการณ์ของคุณ รีวิวจะแสดงหลังการตรวจสอบ",name:"ชื่อของคุณ (ไม่บังคับ)",yourReview:"รีวิวของคุณ",namePlaceholder:"ชื่อของคุณ",reviewPlaceholder:"เขียนประสบการณ์ของคุณ...",addImage:"เพิ่มรูปภาพ (ไม่บังคับ)",submit:"ส่งรีวิว",submitting:"กำลังส่ง...",noReviews:"ยังไม่มีรีวิวที่ได้รับอนุมัติ",serviceProof:"วิดีโอหลักฐานการให้บริการลูกค้า",drawInfo:"งวดถัดไป",last:"งวดล่าสุด",publisher:"ผู้เผยแพร่หลักที่ได้รับอนุญาต",contact:"ติดต่อผ่าน IMO",footer:"เว็บไซต์ข้อมูลอิสระ · ไม่มีส่วนเกี่ยวข้องกับสำนักงานสลากกินแบ่งรัฐบาลไทย",days:"วัน · ชั่วโมง · นาที · วินาที"}
  }[language];
  const chooseLanguage = (value) => { setLanguage(value); try { localStorage.setItem("ariyan-language", value); } catch {} };
  const resultDigits = config.result_text || "---";
  return <div className={`viewer-page lang-${language} ${config.viewer_bold ? "viewer-bold" : ""} ${config.countdown_bold === false ? "countdown-normal" : ""}`} style={{"--viewer-font-size":`${config.viewer_font_size || 16}px`,"--countdown-font-size":`${config.countdown_font_size || 30}px`,"--countdown-label-size":`${config.countdown_label_size || 11}px`}}>
    <div className="language-bar"><div className="language-brand">{config.header_profile_image ? <img className="header-profile-image" src={config.header_profile_image} alt="Header profile"/> : <span className="mini-emblem">✦</span>}<span>{config.brand_title || "THAILAND LOTTERY"} <small>{config.brand_subtitle || "INFORMATION PORTAL"}</small></span></div><label className="language-picker"><Globe size={16}/><select aria-label="Choose language" value={language} onChange={e=>chooseLanguage(e.target.value)}><option value="bn">বাংলা</option><option value="en">English</option><option value="th">ไทย</option></select></label></div>
    <section className="hero">
      <div className="hero-glow"/><div className="hero-inner"><p className="eyebrow gold">{t.tag}</p><h1>{config.title}</h1><p className="hero-sub">{config.hero_subtitle || t.sub}</p>
      <div className="publisher-chip">{config.profile_image ? <img className="publisher-avatar" src={config.profile_image} alt={config.publisher_name || "Publisher"}/> : <span className="publisher-avatar">✦</span>}<span><small>{config.publisher_label || t.publisher}</small><b>{config.publisher_name || "Ariyan Chowdhury"}</b></span></div>
      <div className="countdown-card"><div className="countdown-title"><CalendarClock size={18}/> {t.countdown}</div><div className="countdown-units">{(countdown || "-- : -- : -- : --").split(":").map((part,index)=><div className="countdown-unit" key={index}><strong className="countdown-digits">{part.trim()}</strong><small>{Object.values(config.countdown_labels || defaults.countdown_labels)[index] || ["DAYS","HOURS","MINUTES","SECONDS"][index]}</small></div>)}</div><small className="draw-date-label">{config.draw_at ? `${t.draw}: ${new Date(config.draw_at).toLocaleString(language === "bn" ? "bn-BD" : language === "th" ? "th-TH" : "en-US")}` : t.notSet}</small></div>
      </div>
    </section>
    <main className="viewer-content">
      {(() => {
        const sectionMap = {
          upcoming: <section className="viewer-section" key="upcoming"><div className="viewer-section-head"><div><p className="eyebrow">{t.drawInfo}</p><h2>{t.upcoming}</h2></div></div><p className="muted">{config.upcoming_date ? `${t.date}: ${config.upcoming_date}` : t.upcoming}</p>{config.upcoming_private_path ? <PurchasePortal config={config}/> : <Paper url={config.upcoming_image} label={t.paperMissing}/> }</section>,
          previous: <section className="viewer-section" key="previous"><div className="viewer-section-head"><div><p className="eyebrow">{t.last}</p><h2>{t.previous}</h2></div></div><p className="muted">{config.previous_date ? `${t.date}: ${config.previous_date}` : t.previous}</p><Paper url={config.previous_image} label={t.paperMissing}/></section>,
          result: <section className="viewer-section result-card" key="result"><div className="viewer-section-head"><div><p className="eyebrow">{t.latest}</p><h2>{t.live}</h2></div></div><div className="result-number-wrap"><span>{t.result}</span><strong className="result-number">{resultDigits}</strong><small className="three-up-label">3 UP</small><small>{config.result_text ? t.published : t.notPublished}</small></div><a className="primary link-button" href={config.official_url || "#"} target="_blank" rel="noreferrer">{t.check} <ExternalLink size={16}/></a></section>,
          video: config.video_proof_url ? <section className="viewer-section service-proof-section" key="video"><div className="viewer-section-head"><div><p className="eyebrow">CLIENT EXPERIENCE</p><h2>{t.serviceProof}</h2></div></div><p className="muted">{config.video_caption || "ভিডিওটি এখানে সরাসরি দেখা যাবে।"}</p><div className="service-video-frame"><video className="service-proof-video" src={config.video_proof_url} controls autoPlay muted loop playsInline preload="metadata">Your browser does not support video playback.</video></div></section> : null,
          official: <section className="official-strip" key="official"><Globe size={22}/><div><b>{t.official}</b><small>{t.verify}</small></div><a href={config.official_url || "#"} target="_blank" rel="noreferrer"><ArrowUpRight/></a></section>,
          imo: config.imo_url ? <a className="imo-button" key="imo" href={config.imo_url} target="_blank" rel="noreferrer"><MessageCircle/> {t.contact}</a> : null,
          reviews: config.show_reviews !== false ? <section className="viewer-section reviews-section" key="reviews"><div className="viewer-section-head"><div><p className="eyebrow">{t.feedback}</p><h2>{t.reviews}</h2></div></div><p className="muted">{t.reviewIntro}</p><form className="review-form" onSubmit={submitReview}><label>{t.name}<input value={reviewName} onChange={e=>setReviewName(e.target.value)} placeholder={t.namePlaceholder}/></label><label>{t.yourReview}<textarea rows="4" required value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder={t.reviewPlaceholder}/></label><label className="upload-review"><ImagePlus size={19}/> {reviewImage ? reviewImage.name : t.addImage}<input type="file" accept="image/*" onChange={e=>setReviewImage(e.target.files?.[0]||null)}/></label><button className="primary" disabled={busy}>{busy?t.submitting:t.submit}</button>{message && <p className="notice">{message}</p>}</form><div className="public-reviews">{reviews.length===0 ? <p className="muted">{t.noReviews}</p> : reviews.map(r=><article className="public-review" key={r.id}><div className="review-meta"><b>{r.customer_name}</b><span className="stars">★★★★★</span></div><p>{r.review_text}</p>{r.image_url && <img src={r.image_url} alt="Customer review attachment"/>}</article>)}</div></section> : null
        };
        const order = [...(config.section_order || defaults.section_order)];
        defaults.section_order.forEach(key => { if (!order.includes(key)) order.push(key); });
        const visibility = { ...defaults.section_visibility, ...(config.section_visibility || {}) };
        return order.filter(key => visibility[key] !== false).map(key => sectionMap[key] || null);
      })()}
      <p className="disclaimer">{config.notice}</p>
    </main>
    <footer className="viewer-footer"><b>{(config.publisher_label || t.publisher) + " · " + (config.publisher_name || "Ariyan Chowdhury")}</b><small>{config.footer_custom_text || t.footer}</small></footer>
  </div>;
}

function Paper({url,label}) { return url ? <a className="paper-frame" href={url} target="_blank" rel="noreferrer"><img className="paper-image" src={url} alt="A4 lottery paper"/><span className="paper-open-hint">ছবিটি বড় করে দেখতে চাপ দিন ↗</span></a> : <div className="paper-empty"><ImagePlus size={28}/><span>{label}</span></div>; }

function SetupGuide() {
  return <main className="setup-wrap"><section className="setup-card"><div className="brand-mark"><ShieldCheck/></div><p className="eyebrow">PROJECT STARTER</p><h1>Admin Panel প্রস্তুত করার পরের ধাপ</h1>
    <p className="muted">এই প্যাকেজে Admin Panel, Viewer Website, live sync, image upload এবং review moderation-এর কোড আছে। অনলাইনে চালু করতে Supabase-এর ফ্রি প্রজেক্টের সঙ্গে যুক্ত করতে হবে।</p>
    <ol><li><b>Supabase project তৈরি করো</b><br/>supabase.com-এ গিয়ে Free project তৈরি করো।</li><li><b>SQL চালাও</b><br/><code>supabase/schema.sql</code> ফাইলের কোড SQL Editor-এ রান করো।</li><li><b>Environment variables বসাও</b><br/><code>.env.example</code> কপি করে <code>.env</code> বানাও; Project URL ও anon key বসাও।</li><li><b>Admin account তৈরি করো</b><br/>Supabase Authentication থেকে তোমার ইমেইল দিয়ে user তৈরি করো।</li><li><b>Deploy করো</b><br/>Vercel-এ project deploy করে একই environment variables যোগ করো।</li></ol>
    <div className="notice">নিরাপত্তা: Supabase service_role key কখনো ব্রাউজার বা .env-এর VITE_ ভেরিয়েবলে দেবে না। শুধু anon/public key ব্যবহার করবে।</div>
    <p className="muted small">সম্পূর্ণ ধাপ README.md ফাইলে দেওয়া আছে। সেটআপ না হওয়া পর্যন্ত কোনো পাবলিক Viewer URL তৈরি হবে না।</p>
  </section></main>;
}

export default App;
