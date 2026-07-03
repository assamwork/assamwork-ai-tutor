import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DatabaseZap,
  FileText,
  Folder,
  FolderOpen,
  LibraryBig,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import {
  deleteBook,
  getLibrary,
  getReindexStatus,
  reindexLibrary,
  uploadBook,
} from "../services/libraryService";

const DEFAULT_CATEGORIES = [
  "Polity",
  "History",
  "Geography",
  "Economy",
  "Science & Tech",
  "Environment",
  "General Science",
  "General Mathematics",
  "General English",
  "Reasoning & Aptitude",
  "Assam General Knowledge",
  "Art & Culture",
  "PYQs",
  "MCQs",
  "NCERT Books",
  "Class 10",
  "Class 12",
  "Other Relevant Materials",
];

const FILTERS = [
  { id: "all", label: "All Books" },
  { id: "recent_uploaded", label: "Recently Uploaded" },
  { id: "recent_used", label: "Recently Used" },
  { id: "needs_reindex", label: "Needs Re-index" },
  { id: "duplicates", label: "Duplicate PDFs" },
  { id: "failed", label: "Failed Indexing" },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRelativeDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  return formatDate(value);
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN")
    : "—";
}

function formatBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusStyles(status) {
  if (status === "Indexed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "Not indexed" ||
    status === "uploaded_pending_ingestion"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function statusLabel(status) {
  if (status === "uploaded_pending_ingestion") return "Pending";

  return status || "Unknown";
}

function bookKey(book) {
  return `${book.subject || "Unknown subject"}/${book.book || "Unknown book"}`;
}

function hasIndexingError(book) {
  return Array.isArray(book.health?.indexingErrors) &&
    book.health.indexingErrors.length > 0;
}

function needsReindex(book) {
  if (hasIndexingError(book)) return true;
  if (book.status !== "Indexed") return true;
  if (!book.lastIndexedAt && !book.indexedAt) return true;

  const indexedAt = new Date(book.lastIndexedAt || book.indexedAt).getTime();
  const modifiedAt = new Date(book.modifiedAt).getTime();

  return Number.isFinite(indexedAt) &&
    Number.isFinite(modifiedAt) &&
    modifiedAt > indexedAt;
}

function isRecent(value) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return false;

  return Date.now() - timestamp <= 7 * 86400000;
}

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(
    DEFAULT_CATEGORIES[0]
  );
  const [customSubject, setCustomSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deletingBook, setDeletingBook] = useState("");
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [indexMessage, setIndexMessage] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(() => new Set());
  const [expandedBookKey, setExpandedBookKey] = useState("");
  const [subjectQueries, setSubjectQueries] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const pendingUploadRef = useRef(false);

  const retry = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    setUploadMessage(null);

    const subject =
      selectedSubject === "__custom__"
        ? customSubject.trim()
        : selectedSubject;

    if (!selectedFile) {
      setUploadMessage({
        type: "error",
        text: "Select a PDF file to upload.",
      });
      return;
    }

    if (
      selectedFile.type !== "application/pdf" ||
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadMessage({
        type: "error",
        text: "Only PDF files are allowed.",
      });
      return;
    }

    if (!subject) {
      setUploadMessage({
        type: "error",
        text: "Select or enter a subject/category.",
      });
      return;
    }

    setUploading(true);

    try {
      const uploadedBook = await uploadBook({
        file: selectedFile,
        subject,
      });

      setUploadMessage({
        type: "success",
        text:
          uploadedBook.message ||
          "PDF uploaded. Re-index changed books to make it searchable.",
      });
      pendingUploadRef.current = true;
      setSelectedFile(null);
      setFileInputKey((value) => value + 1);
      setCustomSubject("");
      setSelectedSubject(DEFAULT_CATEGORIES[0]);
      setExpandedSubjects((current) => {
        const next = new Set(current);
        next.add(subject);
        return next;
      });
      retry();
    } catch (uploadError) {
      setUploadMessage({
        type: "error",
        text: uploadError.message || "The PDF upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(book) {
    const confirmed = window.confirm(
      "Delete this PDF from the knowledge library? This action cannot be undone."
    );

    if (!confirmed) return;

    const key = bookKey(book);
    setDeletingBook(key);
    setDeleteMessage(null);

    try {
      const result = await deleteBook({
        subject: book.subject,
        book: book.book,
      });

      setBooks((currentBooks) =>
        currentBooks.filter((currentBook) => bookKey(currentBook) !== key)
      );
      setExpandedBookKey((current) => (current === key ? "" : current));
      setDeleteMessage({
        type: "success",
        text:
          result.vectorCleanup === "pending"
            ? "PDF deleted. Vector cleanup is pending."
            : "PDF deleted.",
      });
      retry();
    } catch (deleteError) {
      setDeleteMessage({
        type: "error",
        text: deleteError.message || "The PDF could not be deleted.",
      });
    } finally {
      setDeletingBook("");
    }
  }

  async function handleReindex({ force = false } = {}) {
    if (indexing) return;

    setIndexing(true);
    setIndexMessage(null);
    let jobStillRunning = false;

    try {
      const result = await reindexLibrary({ force });

      if (!result.success) {
        const firstError = result.errors?.[0]?.error;
        throw new Error(
          firstError ||
            "Re-index failed. Check backend logs and try again."
        );
      }

      setIndexMessage({
        type: "success",
        text:
          result.booksProcessed > 0
            ? "Knowledge index updated."
            : result.message,
        details: `${result.booksProcessed ?? 0} processed, ${
          result.booksSkipped ?? 0
        } unchanged skipped, ${result.chunksAdded ?? 0} chunks indexed.`,
      });
      pendingUploadRef.current = false;
      retry();
    } catch (indexError) {
      jobStillRunning = indexError.status === 409;
      setIndexMessage({
        type: indexError.status === 409 ? "running" : "error",
        text:
          indexError.status === 409
            ? "Re-index is already running."
            : indexError.message ||
              "Re-index failed. Check backend logs and try again.",
      });
    } finally {
      setIndexing(jobStillRunning);
    }
  }

  function toggleSubject(subject) {
    setExpandedSubjects((current) => {
      const next = new Set(current);

      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }

      return next;
    });
  }

  function toggleBook(book) {
    const key = bookKey(book);
    setExpandedBookKey((current) => (current === key ? "" : key));
  }

  useEffect(() => {
    const controller = new AbortController();
    let requestRunning = false;

    async function loadAdminStatus() {
      if (requestRunning) return;
      requestRunning = true;

      const indexResult = await Promise.allSettled([
        getReindexStatus({
          signal: controller.signal,
        }),
      ]);

      requestRunning = false;

      if (controller.signal.aborted) return;

      if (indexResult[0]?.status === "fulfilled") {
        const state = indexResult[0].value;
        setIndexing(Boolean(state.running));

        if (state.running) {
          setIndexMessage({
            type: "running",
            text: "Indexing PDFs...",
          });
        } else if (state.lastResult && !pendingUploadRef.current) {
          setIndexMessage({
            type: state.lastResult.success ? "success" : "error",
            text: state.lastResult.success
              ? "Knowledge index updated."
              : "Re-index failed. Check details below.",
            details: state.lastResult.success
              ? `${state.lastResult.booksProcessed ?? 0} processed, ${
                  state.lastResult.booksSkipped ?? 0
                } unchanged skipped, ${
                  state.lastResult.chunksAdded ?? 0
                } chunks indexed.`
              : state.lastResult.errors?.[0]?.error,
          });
        }
      }
    }

    void loadAdminStatus();
    const interval = window.setInterval(loadAdminStatus, 5000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLibrary() {
      setLoading(true);
      setError("");

      try {
        const library = await getLibrary({
          query,
          signal: controller.signal,
        });

        setBooks(library);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(
            "The knowledge library could not be loaded. Check the backend and try again."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => controller.abort();
  }, [reloadKey, query]);

  const duplicateHashes = useMemo(() => {
    const counts = books.reduce((result, book) => {
      if (book.fileHash) {
        result[book.fileHash] = (result[book.fileHash] || 0) + 1;
      }

      return result;
    }, {});

    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([hash]) => hash)
    );
  }, [books]);

  const filteredBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) =>
      (a.book || "").localeCompare(b.book || "")
    );

    if (activeFilter === "recent_uploaded") {
      return sorted.filter((book) => isRecent(book.uploadedAt));
    }

    if (activeFilter === "recent_used") {
      return sorted.filter((book) => isRecent(book.lastUsedAt));
    }

    if (activeFilter === "needs_reindex") {
      return sorted.filter(needsReindex);
    }

    if (activeFilter === "duplicates") {
      return sorted.filter((book) => duplicateHashes.has(book.fileHash));
    }

    if (activeFilter === "failed") {
      return sorted.filter(hasIndexingError);
    }

    return sorted;
  }, [activeFilter, books, duplicateHashes]);

  const subjectGroups = useMemo(() => {
    return filteredBooks.reduce((result, book) => {
      const subject = book.subject || "Unknown subject";

      if (!result[subject]) {
        result[subject] = [];
      }

      result[subject].push(book);
      return result;
    }, {});
  }, [filteredBooks]);

  const subjects = useMemo(
    () => Object.keys(subjectGroups).sort((a, b) => a.localeCompare(b)),
    [subjectGroups]
  );

  const statistics = useMemo(() => {
    const totalChunks = books.reduce(
      (total, book) => total + (Number(book.chunks) || 0),
      0
    );
    const storage = books.reduce(
      (total, book) => total + (Number(book.fileSize) || 0),
      0
    );
    const indexed = books.filter((book) => book.status === "Indexed").length;
    const changed = books.filter(needsReindex).length;
    const failed = books.filter(hasIndexingError).length;
    const duplicatePdfCount = books.filter((book) =>
      duplicateHashes.has(book.fileHash)
    ).length;
    const recentlyUploaded = books.filter((book) =>
      isRecent(book.uploadedAt)
    ).length;
    const recentlyUsed = books.filter((book) =>
      isRecent(book.lastUsedAt)
    ).length;

    return {
      books: books.length,
      chunks: totalChunks,
      storage,
      indexed,
      changed,
      failed,
      duplicatePdfCount,
      recentlyUploaded,
      recentlyUsed,
    };
  }, [books, duplicateHashes]);

  const filterCounts = useMemo(
    () => ({
      all: books.length,
      recent_uploaded: books.filter((book) => isRecent(book.uploadedAt)).length,
      recent_used: books.filter((book) => isRecent(book.lastUsedAt)).length,
      needs_reindex: books.filter(needsReindex).length,
      duplicates: books.filter((book) => duplicateHashes.has(book.fileHash)).length,
      failed: books.filter(hasIndexingError).length,
    }),
    [books, duplicateHashes]
  );

  const summaryItems = [
    ["Books", formatNumber(statistics.books)],
    ["Chunks", formatNumber(statistics.chunks)],
    ["Storage", formatBytes(statistics.storage)],
    ["Indexed", formatNumber(statistics.indexed)],
    ["Changed", formatNumber(statistics.changed)],
    ["Failed", formatNumber(statistics.failed)],
    ["Duplicates", formatNumber(statistics.duplicatePdfCount)],
    ["Recently Uploaded", formatNumber(statistics.recentlyUploaded)],
    ["Recently Used", formatNumber(statistics.recentlyUsed)],
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Admin · Knowledge Library
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Knowledge Explorer
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage PDFs by subject, search indexed content, and inspect book health.
            </p>
          </div>

          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin text-blue-600" : "text-blue-600"}
            />
            Refresh
          </button>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
            {summaryItems.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="truncate text-sm font-bold text-slate-950" title={value}>
                  {value}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <form
              onSubmit={handleUpload}
              className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_170px]"
            >
              <label className="block min-w-0 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">Choose File</span>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                  disabled={uploading || indexing}
                  className="mt-2 block h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 transition file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 focus:border-blue-400 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] disabled:opacity-60"
                />
              </label>

              <label className="block min-w-0">
                <span className="text-xs font-bold text-slate-700">Subject</span>
                <select
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  disabled={uploading || indexing}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] disabled:opacity-60"
                >
                  {DEFAULT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="__custom__">Create custom category...</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={uploading || indexing}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60 lg:self-end"
              >
                {uploading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {uploading ? "Uploading..." : "Upload PDF"}
              </button>
            </form>

            <div className="min-w-0 xl:w-[420px]">
              <p className="text-xs font-bold text-slate-700">Knowledge Actions</p>
              <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-[minmax(0,1fr)_170px]">
                <button
                  type="button"
                  onClick={() => handleReindex({ force: false })}
                  disabled={indexing || uploading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm shadow-violet-600/15 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 xl:col-span-2"
                >
                  {indexing ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <DatabaseZap size={15} />
                  )}
                  Re-index Changed
                </button>
                <button
                  type="button"
                  onClick={() => handleReindex({ force: true })}
                  disabled={indexing || uploading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={15} />
                  Re-index All
                </button>
                <button
                  type="button"
                  disabled
                  title="AI Analytics dashboard will be available in the next update."
                  className="inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-400"
                >
                  <BarChart3 size={15} />
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

          {selectedSubject === "__custom__" && (
            <label className="mt-3 block max-w-md">
              <span className="text-xs font-bold text-slate-700">
                Custom category name
              </span>
              <input
                type="text"
                value={customSubject}
                onChange={(event) => setCustomSubject(event.target.value)}
                placeholder="Enter a subject/category"
                maxLength={80}
                disabled={uploading || indexing}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
              />
            </label>
          )}

          {(uploadMessage || indexMessage || deleteMessage) && (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {uploadMessage && (
                <Message tone={uploadMessage.type}>{uploadMessage.text}</Message>
              )}
              {indexMessage && (
                <Message tone={indexMessage.type}>
                  <span className="font-semibold">{indexMessage.text}</span>
                  {indexMessage.details && (
                    <span className="mt-1 block text-xs">{indexMessage.details}</span>
                  )}
                </Message>
              )}
              {deleteMessage && (
                <Message tone={deleteMessage.type}>{deleteMessage.text}</Message>
              )}
            </div>
          )}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Filters
            </p>
            <div className="mt-2 space-y-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                    activeFilter === filter.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">
                    {formatNumber(filterCounts[filter.id] || 0)}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-3">
              <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search subject, filename, book title, or indexed content"
                  aria-label="Search knowledge library"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
              </label>
            </div>

            {loading ? (
              <div className="space-y-2 p-3" aria-label="Loading library">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-11 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon={RefreshCw}
                title="Unable to load the library"
                text={error}
                actionLabel="Retry"
                onAction={retry}
              />
            ) : books.length === 0 ? (
              <EmptyState
                icon={LibraryBig}
                title="No PDFs have been added yet"
                text="Use the upload action above to add study material."
              />
            ) : subjects.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching PDFs"
                text="Try another subject, filename, or content phrase."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {subjects.map((subject) => {
                  const subjectBooks = subjectGroups[subject] || [];
                  const expanded = expandedSubjects.has(subject);
                  const forceExpanded = Boolean(query.trim());
                  const visible = expanded || forceExpanded;
                  const subjectQuery = subjectQueries[subject] || "";
                  const visibleBooks = subjectQuery
                    ? subjectBooks.filter((book) =>
                        `${book.book || ""} ${book.filename || ""}`
                          .toLowerCase()
                          .includes(subjectQuery.toLowerCase())
                      )
                    : subjectBooks;

                  return (
                    <div key={subject}>
                      <button
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        {expanded ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                        {visible ? (
                          <FolderOpen size={17} className="text-blue-600" />
                        ) : (
                          <Folder size={17} className="text-blue-600" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                          {subject}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                          {subjectBooks.length}
                        </span>
                      </button>

                      {visible && (
                        <div className="border-t border-slate-100 bg-slate-50/70 px-3 pb-3">
                          <div className="py-2">
                            <label className="flex h-10 max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-blue-400 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]">
                              <Search size={14} className="text-slate-400" />
                              <input
                                type="search"
                                value={subjectQuery}
                                onChange={(event) =>
                                  setSubjectQueries((current) => ({
                                    ...current,
                                    [subject]: event.target.value,
                                  }))
                                }
                                placeholder={`Search in ${subject}`}
                                className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                              />
                            </label>
                          </div>

                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {visibleBooks.map((book) => {
                              const key = bookKey(book);
                              const expandedBook = expandedBookKey === key;

                              return (
                                <div key={key} className="border-b border-slate-100 last:border-b-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleBook(book)}
                                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_24px] items-center gap-3 px-3 py-2 text-left text-xs transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_70px_80px_70px_92px_24px]"
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <FileText size={15} className="shrink-0 text-slate-500" />
                                      <span className="truncate font-semibold text-slate-800">
                                        {book.book || "Unknown PDF"}
                                      </span>
                                    </span>
                                    <span className="hidden text-slate-500 sm:inline">
                                      Pages {formatNumber(book.pageCount)}
                                    </span>
                                    <span className="hidden text-slate-500 sm:inline">
                                      Chunks {formatNumber(book.chunks)}
                                    </span>
                                    <span className="hidden text-slate-500 sm:inline">
                                      v{book.currentVersion || book.version || 1}
                                    </span>
                                    <span className={`hidden justify-self-start rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline ${statusStyles(book.status)}`}>
                                      {statusLabel(book.status)}
                                    </span>
                                    {expandedBook ? (
                                      <ChevronDown size={15} className="text-slate-400" />
                                    ) : (
                                      <ChevronRight size={15} className="text-slate-400" />
                                    )}
                                  </button>

                                  {expandedBook && (
                                    <BookDetail
                                      book={book}
                                      deleting={deletingBook === key}
                                      onDelete={() => handleDelete(book)}
                                    />
                                  )}
                                </div>
                              );
                            })}

                            {visibleBooks.length === 0 && (
                              <p className="px-3 py-4 text-xs text-slate-500">
                                No PDFs match this subject search.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Message({ children, tone }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "running" || tone === "pending"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${toneClass}`}>
      {tone === "success" && <CheckCircle2 size={16} className="mr-2 inline" />}
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, actionLabel, onAction }) {
  return (
    <div className="px-5 py-14 text-center">
      <Icon className="mx-auto text-slate-400" size={32} />
      <p className="mt-4 font-bold text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {text}
      </p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          <RefreshCw size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function BookDetail({ book, deleting, onDelete }) {
  const health = book.health || {};
  const details = [
    ["Pages", formatNumber(book.pageCount)],
    ["Chunks", formatNumber(book.chunks)],
    ["Version", `v${book.currentVersion || book.version || 1}`],
    ["File Size", formatBytes(book.fileSize)],
    ["Hash", book.fileHash || "—"],
    ["Indexed", formatDate(book.lastIndexedAt || book.indexedAt)],
    ["Uploaded", formatDate(book.uploadedAt)],
    ["Questions Answered", formatNumber(book.questionsAnswered)],
    ["Last Used", formatRelativeDate(book.lastUsedAt)],
    ["Duplicate Chunks", formatNumber(health.duplicateChunks || 0)],
    ["Missing Pages", formatNumber(health.missingPageMetadata || 0)],
    ["Embedding Status", health.missingEmbeddings || "Not measured"],
  ];

  return (
    <div className="border-t border-slate-100 bg-white px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                <p className="truncate text-xs font-bold text-slate-800" title={String(value)}>
                  {value}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {Array.isArray(book.searchMatches) && book.searchMatches.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">Preview</p>
              {book.searchMatches.slice(0, 3).map((match, index) => (
                <div
                  key={`${match.chunkId || match.type}-${index}`}
                  className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900"
                >
                  <p className="font-bold">
                    {match.page ? `Page ${match.page}` : "Book metadata"}
                  </p>
                  <p className="mt-1 leading-5 text-blue-800">{match.preview}</p>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(health.indexingErrors) &&
            health.indexingErrors.length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {health.indexingErrors[0]}
              </div>
            )}
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-700">Version History</p>
            <p className="mt-1 text-xs text-slate-500">
              Current v{book.currentVersion || book.version || 1}
            </p>
            <p className="mt-1 break-all text-[11px] text-slate-400">
              Previous: {book.previousVersionId || "None"}
            </p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Delete PDF
          </button>
        </div>
      </div>
    </div>
  );
}
