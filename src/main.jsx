import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  Eye,
  Filter,
  Fullscreen,
  Heart,
  ImagePlus,
  LayoutDashboard,
  Lock,
  LogIn,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  UploadCloud,
  UserPlus,
  UserRoundCheck,
  Users,
  WandSparkles,
  X
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { api, createSocket, mediaUrl } from "./lib/api";
import { apiRoles, roleLabels, statIcons } from "./lib/icons";
import "./styles/app.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const roleAccess = {
  ADMIN: ["Create events", "Publish albums", "Invite roles", "Moderate AI", "Download originals"],
  PHOTOGRAPHER: ["Upload media", "Tag people", "Download own media", "View private shoots"],
  CLUB_MEMBER: ["Like", "Comment", "Save favourites", "Find my photos"],
  VIEWER: ["View public albums", "Share public links", "Download watermarked"]
};

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const [theme, setTheme] = useState(localStorage.getItem("momentra_theme") ?? "dark");
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();

  const notify = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.get("/api/dashboard");
      setDashboard(data);
    } catch (error) {
      if (!api.token) setLoginOpen(true);
      else notify(error.message, "error");
    }
  }, [notify]);

  useEffect(() => {
    localStorage.setItem("momentra_theme", theme);
  }, [theme]);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (api.token) {
          const me = await api.get("/api/me");
          setSession(me.user);
        }
        if (!api.token) {
          const login = await api.post("/api/auth/login", { email: "admin@momentra.app", password: "momentra123" });
          api.setSession(login);
          setSession(login.user);
        }
        await loadDashboard();
      } catch (error) {
        api.clearSession();
        setSession(null);
        setDashboard(null);
        setLoginOpen(true);
        notify(error.message, error.message.includes("not running") ? "error" : "success");
      }
    }
    bootstrap();
  }, [loadDashboard, notify, refreshKey]);

  useEffect(() => {
    if (!session) return undefined;
    const socket = createSocket();
    socket.emit("presence:join", session);
    ["event:created", "event:updated", "album:created", "album:updated", "media:liked", "comment:created", "upload:processed", "notification:new", "user:updated"].forEach((eventName) => {
      socket.on(eventName, () => loadDashboard());
    });
    socket.on("notification:new", (notice) => notify(notice.text));
    return () => socket.disconnect();
  }, [session, loadDashboard, notify]);

  const activeRole = session?.role ?? "VIEWER";
  const events = dashboard?.events ?? [];
  const activeEvent = events[0];

  return (
    <main className={`app ${theme}`}>
      <Sidebar activeRole={activeRole} setTheme={setTheme} theme={theme} session={session} />
      <section className="shell">
        <Topbar query={query} setQuery={setQuery} activeRole={activeRole} onLogin={() => setLoginOpen(true)} onLogout={async () => { try { await api.post("/api/auth/logout", {}); } catch {} api.clearSession(); setSession(null); setDashboard(null); setLoginOpen(true); notify("Logged out"); }} />
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage dashboard={dashboard} query={query} onCreate={() => setCreateEventOpen(true)} onEdit={setEditEvent} onRefresh={() => setRefreshKey((key) => key + 1)} onShare={() => setShareModal({ albumId: activeEvent?.albums?.[0]?.id })} setLightbox={setLightbox} notify={notify} />} />
              <Route path="/albums" element={<AlbumsPage setLightbox={setLightbox} notify={notify} onShare={setShareModal} />} />
              <Route path="/uploads" element={<UploadsPage notify={notify} />} />
              <Route path="/ai-search" element={<AiSearchPage setLightbox={setLightbox} notify={notify} />} />
              <Route path="/access" element={<AccessPage session={session} notify={notify} />} />
              <Route path="/storage" element={<StoragePage notify={notify} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </section>
      <FloatingActions onCreate={() => setCreateEventOpen(true)} />
      <NotificationDock notifications={dashboard?.notifications ?? []} notify={notify} />
      <AnimatePresence>{lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} notify={notify} />}</AnimatePresence>
      <AnimatePresence>{createEventOpen && <CreateEventModal onClose={() => setCreateEventOpen(false)} onCreated={() => { setCreateEventOpen(false); setRefreshKey((key) => key + 1); notify("Event and album created"); }} />}</AnimatePresence>
      <AnimatePresence>{editEvent && <CreateEventModal event={editEvent} onClose={() => setEditEvent(null)} onCreated={() => { setEditEvent(null); setRefreshKey((key) => key + 1); notify("Event updated"); }} />}</AnimatePresence>
      <AnimatePresence>{shareModal && <ShareModal albumId={shareModal.albumId} onClose={() => setShareModal(null)} notify={notify} />}</AnimatePresence>
      <AnimatePresence>{loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={(user) => { setSession(user); setLoginOpen(false); setRefreshKey((key) => key + 1); notify("Session active"); }} />}</AnimatePresence>
      <AnimatePresence>{toast && <Toast toast={toast} />}</AnimatePresence>
    </main>
  );
}

function Sidebar({ activeRole, theme, setTheme, session }) {
  const links = [
    [LayoutDashboard, "Dashboard", "/dashboard"],
    [ImagePlus, "Albums", "/albums"],
    [UploadCloud, "Uploads", "/uploads"],
    [Sparkles, "AI Search", "/ai-search"],
    [ShieldCheck, "Access", "/access"],
    [Cloud, "Storage", "/storage"]
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Camera size={24} /></div>
        <div><strong>Momentra</strong><span>Campus media OS</span></div>
      </div>
      <nav className="nav">
        {links.map(([Icon, label, to]) => (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} key={to} to={to} title={label}>
            <Icon size={18} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="role-switcher">
        <span>Active session</span>
        {Object.entries(roleLabels).map(([role, label]) => (
          <button key={role} className={role === activeRole ? "selected" : ""} type="button">
            <UserRoundCheck size={15} />{label}
          </button>
        ))}
      </div>
      <div className="auth-card small">
        <strong>{session?.name ?? "Loading user"}</strong>
        <span>{session?.email ?? "Signing in..."}</span>
      </div>
      <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}{theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </aside>
  );
}

function Topbar({ query, setQuery, activeRole, onLogin, onLogout }) {
  return (
    <header className="topbar">
      <div className="searchbar"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, tags, dates, faces, uploaders..." /></div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" title="Notifications"><Bell size={18} /></button>
        <button className="login-button" type="button" onClick={onLogin}><LogIn size={17} /> {roleLabels[activeRole]}</button>
        <button className="login-button" type="button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

function DashboardPage({ dashboard, query, onCreate, onEdit, onRefresh, onShare, setLightbox, notify }) {
  const [sortBy, setSortBy] = useState("date");
  const [category, setCategory] = useState("All");
  const [activeEventId, setActiveEventId] = useState(null);
  const events = useMemo(() => {
    const filtered = (dashboard?.events ?? []).filter((event) => {
      const matchesQuery = `${event.name} ${event.category} ${event.description}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "All" || event.category === category;
      return matchesQuery && matchesCategory;
    });
    return filtered.sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "category" ? a.category.localeCompare(b.category) : new Date(b.date) - new Date(a.date));
  }, [dashboard, query, category, sortBy]);
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0];
  const categories = ["All", ...new Set((dashboard?.events ?? []).map((event) => event.category))];

  async function deleteEvent() {
    if (!activeEvent) return;
    await api.delete(`/api/events/${activeEvent.id}`);
    notify("Event deleted and linked album media moved to trash");
    setActiveEventId(null);
    onRefresh();
  }

  if (!dashboard) return <SkeletonPage />;

  return (
    <>
      <Hero activeEvent={activeEvent} onCreate={onCreate} onShare={onShare} />
      <Stats analytics={dashboard.analytics} />
      <section className="workspace-grid">
        <section className="panel wide">
          <div className="section-heading">
            <div><span className="eyebrow"><CalendarDays size={15} /> Event management</span><h2>Albums generated per event</h2></div>
            <div className="toolbar">
              <label className="select-wrap"><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
              <label className="select-wrap"><span>Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Name</option><option value="date">Date</option><option value="category">Category</option></select><ChevronDown size={14} /></label>
            </div>
          </div>
          <div className="event-grid">
            {events.map((event) => <EventCard key={event.id} event={event} active={event.id === activeEvent?.id} onClick={() => setActiveEventId(event.id)} />)}
          </div>
          {activeEvent && <div className="toolbar album-actions"><button onClick={() => onEdit(activeEvent)}><MoreHorizontal size={16} /> Edit event</button><button onClick={deleteEvent}><Trash2 size={16} /> Delete event</button><button onClick={() => setActiveEventId(activeEvent.id)}><Eye size={16} /> View event</button></div>}
          {events.length === 0 && <EmptyState title="No events found" body="Create an event or adjust filters." />}
        </section>
        <AdminPanel activeRole={dashboard.users?.[0]?.role ?? "ADMIN"} users={dashboard.users ?? []} />
      </section>
      <UploadPreview />
      <DashboardGallery event={activeEvent} setLightbox={setLightbox} notify={notify} />
      <AiSuite />
      <SocialAndCloud notifications={dashboard.notifications ?? []} onShare={onShare} />
      <Architecture />
    </>
  );
}

function Hero({ activeEvent, onCreate, onShare }) {
  return (
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,10,12,.88), rgba(9,10,12,.22)), url(${mediaUrl(activeEvent?.coverUrl ?? activeEvent?.cover)})` }}>
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={15} /> Production-ready event media platform</span>
        <h1>Momentra</h1>
        <p>One premium workspace for event albums, uploads, AI discovery, roles, downloads, sharing, and cloud-scale media delivery across clubs and college communities.</p>
        <div className="hero-actions">
          <button type="button" onClick={onCreate}><Plus size={18} /> Create event</button>
          <button type="button" className="secondary" onClick={onShare} disabled={!activeEvent}><QrCode size={18} /> Share album</button>
        </div>
      </div>
      {activeEvent && <div className="hero-panel"><span>Live album</span><strong>{activeEvent.name}</strong><div className="mini-progress"><i style={{ width: `${activeEvent.progress}%` }} /></div><small>{activeEvent.progress}% curated, {activeEvent.assets.toLocaleString()} media assets</small></div>}
    </section>
  );
}

function Stats({ analytics }) {
  return (
    <section className="stats">
      {analytics.map((item) => {
        const Icon = statIcons[item.label] ?? Sparkles;
        return <motion.div className="stat" key={item.label} whileHover={{ y: -4 }}><Icon size={20} /><span>{item.label}</span><strong>{item.value}</strong><small>{item.delta}</small></motion.div>;
      })}
    </section>
  );
}

function EventCard({ event, active, onClick }) {
  return (
    <motion.button className={`event-card ${active ? "active" : ""}`} onClick={onClick} whileHover={{ y: -6 }} type="button">
      <img src={mediaUrl(event.coverUrl)} alt="" loading="lazy" />
      <div className="event-card-body">
        <div><span>{event.category}</span><strong>{event.name}</strong><small>{event.date} • {event.visibility}</small></div>
        <p>{event.description}</p>
        <div className="card-meta"><span><ImagePlus size={14} /> {event.assets}</span><span><Users size={14} /> {event.members}</span></div>
      </div>
    </motion.button>
  );
}

function AdminPanel({ activeRole, users }) {
  return (
    <aside className="panel admin-panel">
      <div className="section-heading compact"><div><span className="eyebrow"><ShieldCheck size={15} /> Access control</span><h2>Role permissions</h2></div></div>
      <div className="auth-card"><div className="avatar-stack">{users.slice(0, 4).map((user) => <img key={user.id} src={user.avatarUrl} alt="" />)}</div><strong>JWT session active</strong><span>Protected routes, RBAC middleware, private albums, and refresh sessions are backed by the API.</span></div>
      <div className="permission-list">{(roleAccess[activeRole] ?? roleAccess.ADMIN).map((item) => <div key={item}><CheckCircle2 size={16} /> {item}</div>)}</div>
      <NavLink to="/access" className="full-button"><Lock size={16} /> Manage album privacy</NavLink>
    </aside>
  );
}

function UploadPreview() {
  return (
    <section className="panel upload-studio">
      <div className="dropzone"><UploadCloud size={34} /><strong>Production upload studio</strong><span>Direct uploads, retries, AI processing, thumbnails, duplicate checks, and metadata storage.</span><NavLink className="dropzone-link" to="/uploads">Open uploads</NavLink></div>
      <div className="upload-queue">{["Signed URL", "Thumbnail worker", "AI tagging"].map((name, index) => <div className="upload-row" key={name}><div><strong>{name}</strong><span>{index === 2 ? "Realtime complete" : "Ready"}</span></div><div className="progress"><i style={{ width: `${100 - index * 18}%` }} /></div><small>{100 - index * 18}%</small></div>)}</div>
    </section>
  );
}

function DashboardGallery({ event, setLightbox, notify }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!event?.albums?.[0]?.id) return;
    api.get(`/api/media?albumId=${event.albums[0].id}`).then((res) => setItems(res.data)).catch((error) => notify(error.message, "error"));
  }, [event, notify]);
  return <GalleryPanel title={event?.name ?? "Gallery"} items={items} setItems={setItems} setLightbox={setLightbox} notify={notify} />;
}

function AlbumsPage({ setLightbox, notify, onShare }) {
  const [albums, setAlbums] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [sort, setSort] = useState("date");
  const [albumModal, setAlbumModal] = useState(false);

  const load = useCallback(async () => {
    const albumRes = await api.get(`/api/albums?sort=${sort}`);
    setAlbums(albumRes.data);
    const selected = activeAlbum ?? albumRes.data[0];
    setActiveAlbum(selected);
    if (selected) setMedia((await api.get(`/api/media?albumId=${selected.id}&limit=50`)).data);
  }, [sort, activeAlbum]);

  useEffect(() => { load().catch((error) => notify(error.message, "error")); }, [sort]);

  async function deleteAlbum(album) {
    await api.delete(`/api/albums/${album.id}`);
    notify("Album deleted and media moved to trash");
    setActiveAlbum(null);
    await load();
  }

  return (
    <>
      <section className="panel gallery-panel">
        <div className="section-heading">
          <div><span className="eyebrow"><ImagePlus size={15} /> Albums</span><h2>Album management</h2></div>
          <div className="toolbar">
            <button onClick={() => setAlbumModal(true)}><Plus size={16} /> Create album</button>
            <label className="select-wrap"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Date</option><option value="popularity">Popularity</option><option value="ai">AI relevance</option><option value="uploadCount">Upload count</option></select><ChevronDown size={14} /></label>
          </div>
        </div>
        <div className="album-strip">
          {albums.map((album) => <button className={activeAlbum?.id === album.id ? "selected" : ""} key={album.id} onClick={async () => { setActiveAlbum(album); setMedia((await api.get(`/api/media?albumId=${album.id}&limit=50`)).data); }}><strong>{album.title}</strong><span>{album.uploadCount} uploads • {album.visibility}</span></button>)}
        </div>
        {activeAlbum && <div className="toolbar album-actions"><button onClick={() => onShare({ albumId: activeAlbum.id })}><Share2 size={16} /> Share</button><button onClick={() => setAlbumModal(activeAlbum)}><MoreHorizontal size={16} /> Edit</button><button onClick={() => deleteAlbum(activeAlbum)}><Trash2 size={16} /> Delete</button></div>}
      </section>
      <GalleryPanel title={activeAlbum?.title ?? "Select an album"} items={media} setItems={setMedia} setLightbox={setLightbox} notify={notify} />
      <AnimatePresence>{albumModal && <AlbumModal album={albumModal === true ? null : albumModal} onClose={() => setAlbumModal(false)} onSaved={() => { setAlbumModal(false); load(); notify("Album saved"); }} />}</AnimatePresence>
    </>
  );
}

function GalleryPanel({ title, items, setItems, setLightbox, notify }) {
  async function updateMedia(next) {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  }
  async function like(item) {
    updateMedia({ ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) });
    try { updateMedia(await api.post(`/api/media/${item.id}/like`)); } catch (error) { notify(error.message, "error"); }
  }
  async function save(item) {
    updateMedia({ ...item, saved: !item.saved });
    try { updateMedia(await api.post(`/api/media/${item.id}/favourite`)); notify(item.saved ? "Removed from favourites" : "Saved to favourites"); } catch (error) { notify(error.message, "error"); }
  }
  return (
    <section className="panel gallery-panel">
      <div className="section-heading"><div><span className="eyebrow"><ImagePlus size={15} /> Google Photos + Pinterest gallery</span><h2>{title}</h2></div><div className="toolbar"><NavLink to="/uploads" className="button-like"><UploadCloud size={16} /> Add media</NavLink></div></div>
      <div className="masonry">
        {items.map((item) => (
          <motion.article className="media-card" key={item.id} whileHover={{ scale: 1.018 }}>
            <button onClick={() => setLightbox({ ...item, onUpdate: updateMedia })} type="button"><img src={mediaUrl(item.thumbnailUrl ?? item.url)} alt={item.caption} loading="lazy" />{item.type === "VIDEO" && <span className="play-badge"><Play size={16} /></span>}</button>
            <div className="media-overlay"><div><strong>{item.caption}</strong><span>{item.tags.join(" • ")}</span></div><div className="media-actions"><button onClick={() => like(item)}><Heart size={16} fill={item.liked ? "currentColor" : "none"} /></button><button onClick={() => setLightbox({ ...item, focusComments: true, onUpdate: updateMedia })}><MessageCircle size={16} /></button><button onClick={() => save(item)}><Bookmark size={16} fill={item.saved ? "currentColor" : "none"} /></button></div></div>
          </motion.article>
        ))}
      </div>
      {items.length === 0 && <EmptyState title="No media yet" body="Upload media or select another album." />}
    </section>
  );
}

function UploadsPage({ notify }) {
  const [albums, setAlbums] = useState([]);
  const [albumId, setAlbumId] = useState("");
  const [files, setFiles] = useState([]);
  const [queue, setQueue] = useState([]);
  const [paused, setPaused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { api.get("/api/albums").then((res) => { setAlbums(res.data); setAlbumId(res.data[0]?.id ?? ""); }); }, []);
  useEffect(() => {
    const socket = createSocket();
    socket.on("upload:processed", (items) => {
      setQueue((current) => current.map((row) => items.some((item) => item.fileName === row.name) ? { ...row, status: "AI indexed", progress: 100 } : row));
    });
    return () => socket.disconnect();
  }, []);

  function addFiles(list) {
    const chosen = Array.from(list);
    setFiles(chosen);
    setQueue(chosen.map((file) => ({ id: `${file.name}-${file.size}`, name: file.name, type: file.type, preview: URL.createObjectURL(file), status: "Ready", progress: 0 })));
  }

  async function startUpload() {
    if (!albumId || files.length === 0) return notify("Choose an album and files first", "error");
    setPaused(false);
    setQueue((rows) => rows.map((row) => ({ ...row, status: "Uploading", progress: 35 })));
    const form = new FormData();
    form.append("albumId", albumId);
    files.forEach((file) => form.append("files", file));
    try {
      const result = await api.post("/api/uploads", form);
      setQueue(result.data.map((item) => ({ id: item.id, name: item.fileName, status: item.processing.stage, progress: item.processing.progress })));
      notify("Upload complete, AI processing started");
    } catch (error) {
      setQueue((rows) => rows.map((row) => ({ ...row, status: "Failed", progress: 0 })));
      notify(error.message, "error");
    }
  }

  return (
    <section className="panel upload-studio full">
      <div className="dropzone" onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} onDragOver={(event) => event.preventDefault()}>
        <UploadCloud size={38} /><strong>Drop media or folders to upload</strong><span>Multi-file queue with pause, retry, progress, metadata capture, and AI processing events.</span>
        <input ref={inputRef} className="hidden-input" type="file" multiple webkitdirectory="" onChange={(event) => addFiles(event.target.files)} />
        <div className="toolbar"><button onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> Choose files</button><button onClick={startUpload}><UploadCloud size={16} /> Start upload</button><button onClick={() => setPaused(!paused)}><RefreshCw size={16} /> {paused ? "Resume" : "Pause"}</button></div>
        <label className="select-wrap"><span>Album</span><select value={albumId} onChange={(event) => setAlbumId(event.target.value)}>{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}</select><ChevronDown size={14} /></label>
      </div>
      <div className="upload-queue">{queue.map((row) => <div className="upload-row with-preview" key={row.id}>{row.preview && (row.type?.startsWith("video") ? <video src={row.preview} muted playsInline /> : <img src={row.preview} alt="" />)}<div><strong>{row.name}</strong><span>{paused ? "Paused" : row.status}</span></div><div className="progress"><i style={{ width: `${paused ? Math.min(row.progress, 48) : row.progress}%` }} /></div><small>{paused ? Math.min(row.progress, 48) : row.progress}%</small></div>)}</div>
      {queue.length === 0 && <EmptyState title="Queue is empty" body="Drag files into the upload studio to begin." />}
    </section>
  );
}

function AiSearchPage({ setLightbox, notify }) {
  const [q, setQ] = useState("people smiling");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const selfieRef = useRef(null);
  async function search() {
    setLoading(true);
    try { setResults((await api.get(`/api/ai/search?q=${encodeURIComponent(q)}`)).data); } catch (error) { notify(error.message, "error"); } finally { setLoading(false); }
  }
  async function findMine(file) {
    const form = new FormData();
    if (file) form.append("selfie", file);
    setLoading(true);
    try { setResults((await api.post("/api/ai/find-my-photos", form)).data); notify("Face search complete"); } catch (error) { notify(error.message, "error"); } finally { setLoading(false); }
  }
  useEffect(() => { search(); }, []);
  return (
    <>
      <section className="ai-grid">
        <div className="panel ai-panel"><span className="eyebrow"><WandSparkles size={15} /> AI find my photos</span><h2>Upload a selfie. Retrieve every match.</h2><div className="face-scan"><img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=420&q=80" alt="" /><div className="scan-ring" /><div className="scan-line" /></div><input ref={selfieRef} className="hidden-input" type="file" accept="image/*" onChange={(event) => findMine(event.target.files?.[0])} /><button className="full-button" onClick={() => selfieRef.current?.click()}><Sparkles size={16} /> Find my photos</button></div>
        <div className="panel"><span className="eyebrow"><Tags size={15} /> Semantic search</span><h2>Search event memories</h2><div className="searchbar standalone"><Search size={18} /><input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Hackathon, beach, Aarav, night events..." /></div><div className="toolbar"><button onClick={search} disabled={loading}><Search size={16} /> Search</button>{["Hackathon", "People smiling", "Beach", "Aarav", "Night events"].map((term) => <button key={term} onClick={() => { setQ(term); setTimeout(search, 0); }}>#{term}</button>)}</div></div>
      </section>
      <GalleryPanel title={loading ? "Searching..." : "AI results"} items={results} setItems={setResults} setLightbox={setLightbox} notify={notify} />
    </>
  );
}

function AccessPage({ session, notify }) {
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const load = useCallback(() => api.get("/api/users").then((res) => setUsers(res.data)).catch((error) => notify(error.message, "error")), [notify]);
  useEffect(() => { load(); }, [load]);
  async function updateUser(user, patch) {
    setBusyId(user.id);
    try { await api.patch(`/api/users/${user.id}`, patch); await load(); notify("User permissions updated"); } catch (error) { notify(error.message, "error"); } finally { setBusyId(null); }
  }
  return (
    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow"><ShieldCheck size={15} /> Access control</span><h2>RBAC admin center</h2></div><button><UserPlus size={16} /> Invite user</button></div>
      <div className="permission-matrix">{Object.entries(roleAccess).map(([role, permissions]) => <div className="auth-card" key={role}><strong>{roleLabels[role]}</strong>{permissions.map((permission) => <span key={permission}><CheckCircle2 size={14} /> {permission}</span>)}</div>)}</div>
      <div className="table-list">{users.map((user) => <div className="table-row" key={user.id}><div className="user-cell"><img src={user.avatarUrl} alt="" /><div><strong>{user.name}</strong><span>{user.email}</span></div></div><select value={user.role} disabled={busyId === user.id || user.id === session?.id} onChange={(event) => updateUser(user, { role: event.target.value })}>{Object.keys(roleLabels).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select><button onClick={() => updateUser(user, { banned: !user.banned })}>{user.banned ? "Unban" : "Ban"}</button></div>)}</div>
    </section>
  );
}

function StoragePage({ notify }) {
  const [storage, setStorage] = useState(null);
  const load = useCallback(() => api.get("/api/storage").then(setStorage).catch((error) => notify(error.message, "error")), [notify]);
  useEffect(() => { load(); }, [load]);
  async function restore(item) {
    await api.post(`/api/media/${item.id}/restore`);
    notify("Media restored");
    load();
  }
  if (!storage) return <SkeletonPage />;
  return (
    <>
      <section className="stats storage-stats">{Object.entries(storage.usage).map(([key, value]) => <div className="stat" key={key}><Cloud size={20} /><span>{key}</span><strong>{String(value)}</strong><small>live storage metric</small></div>)}</section>
      <section className="panel"><span className="eyebrow"><Cloud size={15} /> Storage analytics</span><h2>Upload trends and AI processing</h2><div className="chart">{storage.trends.map((bar) => <div key={bar.label}><i style={{ height: `${bar.uploads * 3}px` }} /><span>{bar.label}</span></div>)}</div></section>
      <section className="workspace-grid"><div className="panel"><h2>Recent uploads</h2><div className="activity-feed">{storage.recentUploads.map((item) => <div className="activity" key={item.id}><ImagePlus size={17} /><div><strong>{item.fileName}</strong><span>{item.processing.status} • {item.metadata.sizeMb}MB</span></div></div>)}</div></div><div className="panel"><h2>Trash restore</h2><div className="activity-feed">{storage.trash.map((item) => <div className="activity" key={item.id}><Trash2 size={17} /><div><strong>{item.fileName}</strong><span>{item.deletedAt}</span></div><button onClick={() => restore(item)}>Restore</button></div>)}{storage.trash.length === 0 && <EmptyState title="Trash is empty" body="Deleted media appears here." />}</div></div></section>
    </>
  );
}

function AiSuite() {
  return (
    <section className="ai-grid">
      <div className="panel ai-panel"><span className="eyebrow"><WandSparkles size={15} /> AI find my photos</span><h2>Face search with indexed event media.</h2><div className="face-scan"><img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=420&q=80" alt="" /><div className="scan-ring" /><div className="scan-line" /></div><NavLink to="/ai-search" className="full-button"><Eye size={16} /> Open AI search</NavLink></div>
      <div className="panel"><span className="eyebrow"><Tags size={15} /> Smart tagging and search</span><h2>Detected tags</h2><div className="tag-cloud">{["crowd", "stage", "concert", "workshop", "mountains", "sports", "beach", "friends", "winner", "dance"].map((tag) => <NavLink to={`/ai-search?q=${tag}`} key={tag}>#{tag}</NavLink>)}</div><div className="caption-box"><Sparkles size={18} /><p>AI captions, tags, moderation, duplicate checks, and face matches are persisted with every upload.</p></div></div>
    </section>
  );
}

function SocialAndCloud({ notifications, onShare }) {
  return (
    <section className="workspace-grid">
      <div className="panel"><span className="eyebrow"><Bell size={15} /> Realtime social layer</span><h2>Instagram-speed interactions</h2><div className="activity-feed">{notifications.map((notice) => <NotificationRow key={notice.id} notice={notice} />)}</div></div>
      <div className="panel qr-panel"><span className="eyebrow"><QrCode size={15} /> QR album sharing</span><h2>Instant event handoff</h2><div className="qr-wrap"><QRCodeCanvas value="https://momentra.app/a/live" size={146} bgColor="transparent" fgColor="currentColor" /></div><p>Public links resolve to CDN media, while private albums require signed sessions and role checks.</p><button className="full-button" onClick={onShare}><QrCode size={16} /> Generate share link</button></div>
    </section>
  );
}

function Architecture() {
  const lanes = [["Client", "React PWA, lazy images, offline cache"], ["API", "Node Express, JWT, RBAC, Socket.IO"], ["Data", "PostgreSQL Prisma schema plus local persistence"], ["Media", "S3 adapter, signed uploads, CDN, watermark policy"], ["AI", "Tagging, face search, duplicates, moderation"]];
  return <section className="panel architecture"><span className="eyebrow"><Cloud size={15} /> Scalable cloud architecture</span><h2>Production path from upload to AI discovery</h2><div className="architecture-flow">{lanes.map(([title, body]) => <div className="architecture-node" key={title}><strong>{title}</strong><span>{body}</span></div>)}</div></section>;
}

function NotificationDock({ notifications, notify }) {
  return <aside className="notification-dock">{notifications.slice(0, 3).map((notice) => <NotificationToast key={notice.id} notice={notice} notify={notify} />)}</aside>;
}

function NotificationToast({ notice, notify }) {
  async function markRead() {
    await api.post(`/api/notifications/${notice.id}/read`);
    notify("Notification marked read");
  }
  return <motion.button className={`toast ${notice.readAt ? "read" : ""}`} onClick={markRead} initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }}><Bell size={16} /><span>{notice.text}</span></motion.button>;
}

function NotificationRow({ notice }) {
  const navigate = useNavigate();
  return <button className="activity" onClick={() => navigate(notice.entityType === "event" ? "/dashboard" : "/albums")}><Bell size={17} /><div><strong>{notice.text}</strong><span>{notice.readAt ? "Read" : "Unread"} • {new Date(notice.createdAt).toLocaleTimeString()}</span></div></button>;
}

function FloatingActions({ onCreate }) {
  const navigate = useNavigate();
  return <div className="fab-stack"><button title="Create event" onClick={onCreate}><Plus size={20} /></button><button title="Upload media" onClick={() => navigate("/uploads")}><UploadCloud size={20} /></button></div>;
}

function Lightbox({ item, onClose, notify }) {
  const [media, setMedia] = useState(item);
  const [comment, setComment] = useState("");
  async function download() {
    const result = await api.post(`/api/media/${media.id}/download`, {});
    notify(`Watermark: ${result.watermark.text}`);
    window.open(mediaUrl(result.url), "_blank", "noopener,noreferrer");
  }
  async function postComment(parentId = null) {
    if (!comment.trim()) return;
    const created = await api.post(`/api/media/${media.id}/comments`, { body: comment, parentId });
    setMedia((current) => ({ ...current, comments: [...current.comments, created] }));
    setComment("");
    notify("Comment posted");
  }
  async function tagMe() {
    const updated = await api.post(`/api/media/${media.id}/tag`, { userId: "usr_member" });
    setMedia(updated);
    notify("User tagged");
  }
  return (
    <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="close" onClick={onClose} title="Close"><X size={22} /></button><button className="fullscreen" title="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}><Fullscreen size={20} /></button>
      <img src={mediaUrl(media.url)} alt={media.caption} />
      <div className="lightbox-meta"><div><strong>{media.caption}</strong><span>{media.tags.join(" • ")} • {media.metadata?.camera ?? "Uploaded media"}</span></div><div><button onClick={download}><Download size={16} /> Watermarked</button><button onClick={tagMe}><Tags size={16} /> Tag</button><button onClick={() => navigator.share?.({ title: media.caption, url: mediaUrl(media.url) }) ?? navigator.clipboard.writeText(mediaUrl(media.url))}><Share2 size={16} /> Share</button></div></div>
      <div className="comment-panel"><div className="comment-list">{media.comments?.map((entry) => <div className="comment" key={entry.id}><strong>{entry.user?.name}</strong><span>{entry.body}</span>{entry.replies?.map((reply) => <small key={reply.id}>{reply.user?.name}: {reply.body}</small>)}</div>)}</div><div className="comment-box"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment with emoji or @mention..." /><button onClick={() => postComment()}><Send size={16} /></button></div></div>
    </motion.div>
  );
}

function CreateEventModal({ event: existingEvent, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: existingEvent?.name ?? "",
    description: existingEvent?.description ?? "",
    date: existingEvent?.date?.slice(0, 10) ?? "",
    category: existingEvent?.category ?? "Fest",
    privacy: existingEvent?.privacy ?? "PRIVATE",
    clubName: existingEvent?.clubName ?? "Campus Club"
  });
  const [cover, setCover] = useState(null);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (cover) data.append("cover", cover);
    try {
      if (existingEvent) await api.patch(`/api/events/${existingEvent.id}`, form);
      else await api.post("/api/events", data);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return <Modal title={existingEvent ? "Edit event" : "Create event"} onClose={onClose}><form className="modal-form" onSubmit={submit}>{["name", "description", "date", "clubName"].map((key) => <label key={key}>{key}<input type={key === "date" ? "date" : "text"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required /></label>)}<label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Fest</option><option>Workshop</option><option>Trip</option><option>Party</option><option>Competition</option></select></label><label>Privacy<select value={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.value })}><option value="PUBLIC">Public</option><option value="CLUB_ONLY">Club only</option><option value="PRIVATE">Private</option></select></label>{!existingEvent && <label>Cover image<input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0])} /></label>}{error && <p className="error-text">{error}</p>}<button className="full-button" disabled={saving}>{saving ? "Saving..." : "Save event"}</button></form></Modal>;
}

function ShareModal({ albumId, onClose, notify }) {
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [privacy, setPrivacy] = useState("PUBLIC");
  const [share, setShare] = useState(null);
  async function generate() {
    const result = await api.post("/api/share", { albumId, privacy, expiresInHours: Number(expiresInHours) });
    setShare(result);
    notify("Share link generated");
  }
  async function copy() {
    await navigator.clipboard.writeText(share.url);
    notify("Copied to clipboard");
  }
  return <Modal title="Share album" onClose={onClose}><div className="modal-form"><label>Privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value)}><option>PUBLIC</option><option>PRIVATE</option></select></label><label>Expires in hours<input type="number" min="1" max="720" value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)} /></label><button className="full-button" onClick={generate}><QrCode size={16} /> Generate link</button>{share && <div className="share-result"><div className="qr-wrap"><QRCodeCanvas value={share.url} size={142} bgColor="transparent" fgColor="currentColor" /></div><input readOnly value={share.url} /><button onClick={copy}><Copy size={16} /> Copy</button></div>}</div></Modal>;
}

function AlbumModal({ album, onClose, onSaved }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ eventId: album?.eventId ?? "", title: album?.title ?? "", description: album?.description ?? "", visibility: album?.visibility ?? "PRIVATE", collaborative: album?.collaborative ?? false });
  useEffect(() => { api.get("/api/events").then((res) => { setEvents(res.data); setForm((current) => ({ ...current, eventId: current.eventId || res.data[0]?.id || "" })); }); }, []);
  async function submit(event) {
    event.preventDefault();
    if (album) await api.patch(`/api/albums/${album.id}`, form);
    else await api.post("/api/albums", form);
    onSaved();
  }
  return <Modal title={album ? "Edit album" : "Create album"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Event<select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Visibility<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option>PUBLIC</option><option>CLUB_ONLY</option><option>PRIVATE</option></select></label><label className="checkbox"><input type="checkbox" checked={form.collaborative} onChange={(event) => setForm({ ...form, collaborative: event.target.checked })} /> Collaborative album</label><button className="full-button">Save album</button></form></Modal>;
}

function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "admin@momentra.app", password: "momentra123" });
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      const payload = mode === "signup" ? { ...form, name: form.name || form.email.split("@")[0] } : form;
      const login = await api.post(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", payload);
      api.setSession(login);
      onLogin(login.user);
    } catch (err) { setError(err.message); }
  }
  return <Modal title={mode === "signup" ? "Signup" : "Login"} onClose={onClose}><form className="modal-form" onSubmit={submit}>{mode === "signup" && <label>Name<input value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}<label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <p className="error-text">{error}</p>}<button className="full-button">{mode === "signup" ? "Create account" : "Login"}</button><button type="button" className="button-like" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Use existing account" : "Create new account"}</button><small>Demo accounts: admin@momentra.app, photo@momentra.app, member@momentra.app, viewer@momentra.app. Password: momentra123.</small></form></Modal>;
}

function Modal({ title, children, onClose }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="modal-card" initial={{ y: 20, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: .98 }}><div className="section-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{children}</motion.div></motion.div>;
}

function Toast({ toast }) {
  return <motion.div className={`app-toast ${toast.type}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>{toast.message}</motion.div>;
}

function SkeletonPage() {
  return <section className="panel skeleton-page"><div /><div /><div /></section>;
}

function EmptyState({ title, body }) {
  return <div className="empty-state"><Sparkles size={22} /><strong>{title}</strong><span>{body}</span></div>;
}

createRoot(document.getElementById("root")).render(<App />);
