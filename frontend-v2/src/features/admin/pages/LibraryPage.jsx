import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Database,
  DatabaseZap,
  FileText,
  LibraryBig,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Upload,
} from "lucide-react";

import {
  deleteBook,
  getLibrary,
  getReindexStatus,
  getSystemStatus,
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
  if (status === "uploaded_pending_ingestion") {
    return "Pending ingestion";
  }

  return status || "Unknown";
}

function healthStyles(label, value) {
  const normalized = String(value || "").toLowerCase();

  if (
    ["Backend", "RAG", "ChromaDB"].includes(label) &&
    ["online", "ready", "healthy"].includes(normalized)
  ) {
    return {
      card: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-600",
      value: "text-emerald-800",
    };
  }

  if (normalized === "unknown" || normalized === "not_ready") {
    return {
      card: "border-amber-200 bg-amber-50",
      icon: "text-amber-600",
      value: "text-amber-800",
    };
  }

  return {
    card: "border-slate-200 bg-slate-50",
    icon: "text-slate-500",
    value: "text-slate-800",
  };
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
  const [systemStatus, setSystemStatus] = useState(null);
  const [systemStatusError, setSystemStatusError] = useState("");
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
        text: "Select a PDF ebook to upload.",
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
          "PDF uploaded but not indexed yet. Click Make Available to AI.",
      });
      setIndexMessage({
        type: "pending",
        text: "PDF uploaded but not indexed yet.",
      });
      pendingUploadRef.current = true;
      setSelectedFile(null);
      setFileInputKey((value) => value + 1);
      setCustomSubject("");
      setSelectedSubject(DEFAULT_CATEGORIES[0]);
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
      "Delete this ebook from the knowledge library? This action cannot be undone."
    );

    if (!confirmed) return;

    const bookKey = `${book.subject}/${book.book}`;
    setDeletingBook(bookKey);
    setDeleteMessage(null);

    try {
      const result = await deleteBook({
        subject: book.subject,
        book: book.book,
      });

      setBooks((currentBooks) =>
        currentBooks.filter(
          (currentBook) =>
            !(
              currentBook.subject === book.subject &&
              currentBook.book === book.book
            )
        )
      );
      setDeleteMessage({
        type: "success",
        text:
          result.vectorCleanup === "pending"
            ? "Ebook deleted. Vector cleanup is pending."
            : "Ebook deleted.",
      });
      retry();
    } catch (deleteError) {
      setDeleteMessage({
        type: "error",
        text: deleteError.message || "The ebook could not be deleted.",
      });
    } finally {
      setDeletingBook("");
    }
  }

  async function handleReindex() {
    if (indexing) return;

    setIndexing(true);
    setIndexMessage(null);
    let jobStillRunning = false;

    try {
      const result = await reindexLibrary();

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
            ? "Library indexed successfully. New PDFs are now available to AssamWork AI."
            : result.message,
        details: `${result.booksProcessed ?? 0} book(s), ${
          result.chunksAdded ?? 0
        } chunk(s) indexed.`,
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
      if (!jobStillRunning) {
        setIndexing(false);
      } else {
        setIndexing(true);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let requestRunning = false;

    async function loadAdminStatus() {
      if (requestRunning) return;
      requestRunning = true;

      const [indexResult, systemResult] = await Promise.allSettled([
        getReindexStatus({
          signal: controller.signal,
        }),
        getSystemStatus({
          signal: controller.signal,
        }),
      ]);

      requestRunning = false;

      if (controller.signal.aborted) return;

      if (indexResult.status === "fulfilled") {
        const state = indexResult.value;
        setIndexing(Boolean(state.running));

        if (state.running) {
          setIndexMessage({
            type: "running",
            text: "Indexing PDFs…",
          });
        } else if (state.lastResult && !pendingUploadRef.current) {
          setIndexMessage({
            type: state.lastResult.success ? "success" : "error",
            text: state.lastResult.success
              ? "Library indexed successfully."
              : "Re-index failed. Check details below.",
            details: state.lastResult.success
              ? `${state.lastResult.booksProcessed ?? 0} book(s), ${
                  state.lastResult.chunksAdded ?? 0
                } chunk(s) indexed.`
              : state.lastResult.errors?.[0]?.error,
          });
        }
      }

      if (systemResult.status === "fulfilled") {
        setSystemStatus(systemResult.value);
        setSystemStatusError("");
      } else if (systemResult.reason?.name !== "AbortError") {
        setSystemStatusError("System status is unavailable.");
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
          signal: controller.signal,
        });

        setBooks(library);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(
            "The ebook library could not be loaded. Check the backend and try again."
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
  }, [reloadKey]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return books;

    return books.filter((book) =>
      `${book.book || ""} ${book.subject || ""}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [books, query]);

  const groups = useMemo(() => {
    return filteredBooks.reduce((result, book) => {
      const subject = book.subject || "Unknown subject";

      if (!result[subject]) {
        result[subject] = [];
      }

      result[subject].push(book);
      return result;
    }, {});
  }, [filteredBooks]);

  const statistics = useMemo(() => {
    const subjects = new Set(
      books.map((book) => book.subject || "Unknown subject")
    );
    const knownChunks = books
      .filter((book) => typeof book.chunks === "number")
      .reduce((total, book) => total + book.chunks, 0);
    const hasKnownChunks = books.some(
      (book) => typeof book.chunks === "number"
    );
    const timestamps = books
      .filter((book) => book.uploadedAt)
      .map((book) => new Date(book.uploadedAt).getTime())
      .filter(Number.isFinite);

    return {
      subjects: subjects.size,
      books: books.length,
      chunks: hasKnownChunks
        ? knownChunks.toLocaleString("en-IN")
        : "—",
      updated:
        timestamps.length > 0
          ? formatDate(Math.max(...timestamps))
          : "—",
    };
  }, [books]);

  const summaryCards = [
    {
      label: "Total Subjects",
      value: statistics.subjects,
      icon: Boxes,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Total Books",
      value: statistics.books,
      icon: BookOpen,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Estimated Chunks",
      value: statistics.chunks,
      icon: FileText,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Last Updated",
      value: statistics.updated,
      icon: CalendarClock,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Admin · Ebook Library
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Knowledge Library
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage the ebooks used by AssamWork AI.
            </p>
          </div>

          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin text-blue-600" : "text-blue-600"}
            />
            Refresh library
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, color }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon size={19} />
              </div>
              <p className="mt-4 break-words text-xl font-bold text-slate-950 sm:text-2xl">
                {loading ? "—" : value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </article>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Activity size={21} />
              </div>
              <div>
                <h2 className="font-bold text-slate-950">System Health</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live status of the AssamWork AI knowledge system.
                </p>
              </div>
            </div>
            {systemStatusError && (
              <span className="text-xs font-semibold text-amber-700">
                {systemStatusError}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              {
                label: "Backend",
                value: systemStatus?.backend || "unknown",
                icon: Server,
              },
              {
                label: "RAG",
                value: systemStatus?.rag || "unknown",
                icon: Bot,
              },
              {
                label: "ChromaDB",
                value: systemStatus?.chroma || "unknown",
                icon: Database,
              },
              {
                label: "Books",
                value: systemStatus?.libraryBooks ?? "—",
                icon: BookOpen,
              },
              {
                label: "Chunks",
                value:
                  typeof systemStatus?.libraryChunks === "number"
                    ? systemStatus.libraryChunks.toLocaleString("en-IN")
                    : "—",
                icon: FileText,
              },
              {
                label: "Last indexed",
                value: formatDate(systemStatus?.lastIndexed),
                icon: CalendarClock,
              },
            ].map(({ label, value, icon: Icon }) => {
              const tone = healthStyles(label, value);

              return (
                <div
                  key={label}
                  className={`min-w-0 rounded-xl border p-3 ${tone.card}`}
                >
                  <Icon size={16} className={tone.icon} />
                  <p
                    className={`mt-3 truncate text-sm font-bold capitalize ${tone.value}`}
                    title={String(value)}
                  >
                    {String(value).replace("_", " ")}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="border-b border-slate-200 pb-5">
            <h2 className="font-bold text-slate-950">Knowledge Workflow</h2>
            <p className="mt-1 text-sm text-slate-500">
              Complete these three steps to add study material to AssamWork AI.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                "Upload PDF",
                "Re-index Library",
                "Ask AI from uploaded ebook",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Upload size={21} />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Upload Ebook</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Add a PDF to the knowledge folder, then re-index the library
                to make it available to AI answers.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleUpload}
            className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)_auto] lg:items-end"
          >
            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-700">
                PDF ebook
              </span>
              <input
                key={fileInputKey}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
                disabled={uploading || indexing}
                className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 disabled:opacity-60"
              />
            </label>

            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-700">
                Subject/category
              </span>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                disabled={uploading || indexing}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
              >
                {DEFAULT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value="__custom__">Create custom category…</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={uploading || indexing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Upload size={17} />
              )}
              {uploading ? "Uploading…" : "Upload PDF"}
            </button>
          </form>

          {selectedSubject === "__custom__" && (
            <label className="mt-4 block max-w-xl">
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
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </label>
          )}

          {uploadMessage && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                uploadMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {uploadMessage.type === "success" && (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              )}
              <p>{uploadMessage.text}</p>
            </div>
          )}

          <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <DatabaseZap size={19} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Make uploaded PDFs available to AI
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Run this after uploading PDFs to make them available to AI
                  answers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReindex}
              disabled={indexing || uploading}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {indexing ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <DatabaseZap size={17} />
              )}
              {indexing ? "Indexing PDFs…" : "Make Available to AI"}
            </button>
          </div>

          {indexMessage && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                indexMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : indexMessage.type === "running" ||
                    indexMessage.type === "pending"
                  ? "border-violet-200 bg-violet-50 text-violet-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <p className="font-semibold">{indexMessage.text}</p>
              {indexMessage.details && (
                <p className="mt-1 text-xs">{indexMessage.details}</p>
              )}
            </div>
          )}
        </section>

        {deleteMessage && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              deleteMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {deleteMessage.text}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <label className="flex max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by book or subject"
                aria-label="Search ebook library"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
              />
            </label>
          </div>

          {loading ? (
            <div className="space-y-3 p-4 sm:p-5" aria-label="Loading library">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : error ? (
            <div className="px-5 py-16 text-center">
              <RefreshCw className="mx-auto text-slate-400" size={34} />
              <p className="mt-4 font-bold text-slate-800">
                Unable to load the library
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {error}
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <LibraryBig size={30} />
              </div>
              <p className="mt-5 font-bold text-slate-800">
                No ebooks have been added yet.
              </p>
              <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                Use the upload form above
              </span>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Search className="mx-auto text-slate-400" size={30} />
              <p className="mt-4 font-bold text-slate-800">
                No matching ebooks
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try another book name or subject.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {Object.entries(groups).map(([subject, subjectBooks]) => (
                <div key={subject} className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen size={17} className="text-blue-600" />
                    <h2 className="font-bold text-slate-900">{subject}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                      {subjectBooks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {subjectBooks.map((book, index) => (
                      <article
                        key={`${book.subject}-${book.book}-${index}`}
                        className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-3.5 sm:grid-cols-[minmax(0,1fr)_130px_100px_110px_44px] sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-slate-800">
                              {book.book || "Unknown book"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 sm:hidden">
                              {book.subject || "Unknown subject"}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 sm:hidden">
                            Uploaded:{" "}
                          </span>
                          {formatDate(book.uploadedAt)}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 sm:hidden">
                            Chunks:{" "}
                          </span>
                          {typeof book.chunks === "number"
                            ? book.chunks.toLocaleString("en-IN")
                            : "—"}
                        </div>
                        <div>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles(book.status)}`}
                          >
                            {statusLabel(book.status)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(book)}
                          disabled={
                            deletingBook === `${book.subject}/${book.book}`
                          }
                          aria-label={`Delete ${book.book}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingBook ===
                          `${book.subject}/${book.book}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
