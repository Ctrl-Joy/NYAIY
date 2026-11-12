/**
 * Reports from the current browser tab, kept in sessionStorage.
 * Nothing is stored on a server, and it is gone when the tab closes.
 */
const KEY = 'nyaiy.reports.v1';
const MAX_REPORTS = 6;

export const loadReports = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.analysis) : [];
  } catch {
    return [];
  }
};

const persist = (list) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or unavailable: the report still works for this page view.
  }
  return list;
};

/** Insert or update a report, newest first. */
export const saveReport = (list, report) =>
  persist([report, ...list.filter((r) => r.id !== report.id)].slice(0, MAX_REPORTS));

export const clearReports = () => persist([]);
