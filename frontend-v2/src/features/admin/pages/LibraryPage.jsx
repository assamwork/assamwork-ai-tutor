import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Boxes,
  CalendarClock,
  FileText,
  LibraryBig,
  RefreshCw,
  Search,
} from "lucide-react";

import { getLibrary } from "../services/libraryService";

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

  if (status === "Not indexed") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((value) => value + 1);
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
          console.error(loadError);
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

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <LibraryBig size={16} className="text-blue-600" />
            Read-only library management
          </div>
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
                Upload coming soon
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
                        className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-3.5 sm:grid-cols-[minmax(0,1fr)_140px_110px_100px] sm:items-center"
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
                            {book.status || "Unknown"}
                          </span>
                        </div>
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
