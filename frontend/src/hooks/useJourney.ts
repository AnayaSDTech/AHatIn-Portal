import { useMemo } from 'react';
import { api } from '../lib/api/client';
import { act, mutate } from '../lib/api/store';
import { ApiError } from '../lib/api/types';
import type { CareerPlanInput, ScholarshipStatus, ServiceCode, ServiceStatus, ShortlistItem, VisaStage } from '../lib/journey';
import type { AppState, DocCategory } from '../data/staff';

/** Sends a file for a document: get a short-lived upload URL, upload the file, then confirm. */
async function uploadFile(studentId: string, docId: string, file: File) {
  const base = `/students/${studentId}/documents/${docId}`;
  const target = await api.post<{ uploadId: string; url: string; method: string; headers: Record<string, string> }>(`${base}/upload-url`, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  // Straight to the document bucket with a short-lived presigned URL (no cookies).
  const res = await fetch(target.url, { method: target.method, headers: target.headers, body: file, credentials: 'omit' });
  if (!res.ok) throw new ApiError(res.status, 'The upload failed. Please check your connection and try again.');
  await api.post(`${base}/upload-complete`, { uploadId: target.uploadId });
}

/**
 * Every event that moves a student's journey forward, in one place. Student and staff screens both call
 * these, and the server applies the rules and records who did what in the student's history, so both
 * sides always see the same record (and the same progress worked out from it).
 */
export function useStudentActions(studentId: string | undefined) {
  return useMemo(() => {
    const base = `/students/${studentId}`;

    return {
      /* ---------- 1. Career counselling ---------- */
      /** Records the agreed career plan, or updates it. Rejects with the reason if it can't be saved. */
      recordCareerPlan: (plan: CareerPlanInput) => mutate(() => api.post(`${base}/career-plan`, plan), { silent: true }),

      /* ---------- 2. Shortlist ---------- */
      /**
       * Options can be added at any time. Once shared, the student sees the new option straight away;
       * once approved, adding one re-opens the shortlist for the student (earlier choices are kept).
       */
      addShortlistItem: (item: Omit<ShortlistItem, 'id' | 'comments' | 'choice' | 'removeReason' | 'addedAt'>) => act(() => api.post(`${base}/shortlist/items`, item)),
      removeShortlistItem: (itemId: string) => act(() => api.delete(`${base}/shortlist/items/${itemId}`)),
      shareShortlist: () => act(() => api.post(`${base}/shortlist/share`)),
      reviseShortlist: () => act(() => api.post(`${base}/shortlist/revise`)),
      commentOnItem: (itemId: string, text: string) => act(() => api.post(`${base}/shortlist/items/${itemId}/comments`, { text })),
      setChoice: (itemId: string, choice: 'apply' | 'removed' | undefined, reason?: string) =>
        act(() => api.put(`${base}/shortlist/items/${itemId}/choice`, { choice: choice ?? null, reason: reason ?? null })),
      /** Student approves: draft applications are created for every option they chose. */
      approveShortlist: (summary: string) => act(() => api.post(`${base}/shortlist/approve`, { summary })),

      /* ---------- 3. Applications ---------- */
      setApplicationState: (appId: string, _university: string, _from: AppState, to: AppState) => act(() => api.post(`${base}/applications/${appId}/status`, { to })),
      /** Counsellor fixes a status chosen by mistake: any status except the student's own decisions, with a reason. */
      correctApplicationState: (appId: string, _university: string, _from: AppState, to: AppState, reason: string) =>
        act(() => api.post(`${base}/applications/${appId}/correct`, { to, reason })),
      /** Student accepts or declines an offer. */
      decideOffer: (appId: string, accept: boolean, _university: string) => act(() => api.post(`${base}/applications/${appId}/decision`, { accept })),

      /* ---------- 4. Funding ---------- */
      setEstimatedCost: (lakh: number) => act(() => api.put(`${base}/funding/estimated-cost`, { lakh })),
      addFundingSource: (kind: string, amount: number) => act(() => api.post(`${base}/funding/sources`, { kind, amount })),
      removeFundingSource: (id: string) => act(() => api.delete(`${base}/funding/sources/${id}`)),
      addScholarship: (name: string, amount: string, deadline: string) => act(() => api.post(`${base}/funding/scholarships`, { name, amount, deadline })),
      setScholarshipStatus: (id: string, status: ScholarshipStatus) => act(() => api.patch(`${base}/funding/scholarships/${id}`, { status })),

      /* ---------- Documents (all services) ---------- */
      requestDocument: (name: string, category: DocCategory) => act(() => api.post(`${base}/documents`, { name, category })),
      /** Counsellor removes a duplicate or mistaken request. Verified documents are kept. */
      removeDocument: (docId: string, _name: string, _hadFile: boolean) => act(() => api.delete(`${base}/documents/${docId}`)),
      /** Uploads the file; the promise rejects with the reason if it can't be accepted. */
      uploadDocument: (docId: string, file: File) => mutate(() => uploadFile(studentId!, docId, file), { silent: true }),
      /** Student takes back a file uploaded by mistake, before it is checked. */
      removeUpload: (docId: string, _name: string) => act(() => api.delete(`${base}/documents/${docId}/file`)),
      verifyDocument: (docId: string, _name: string) => act(() => api.post(`${base}/documents/${docId}/verify`)),
      rejectDocument: (docId: string, _name: string, reason: string) => act(() => api.post(`${base}/documents/${docId}/reject`, { reason })),

      /* ---------- 5. Visa ---------- */
      setVisaStage: (to: VisaStage, note?: string, reference?: string) => act(() => api.post(`${base}/visa`, { stage: to, note: note ?? null, reference: reference ?? null })),

      /* ---------- 6. Pre-departure ---------- */
      toggleDepartureTask: (key: string, done: boolean) => act(() => api.put(`${base}/departure/tasks/${key}`, { done })),
      confirmDeparture: () => act(() => api.post(`${base}/departure/confirm`)),

      /* ---------- 7. Post-arrival ---------- */
      confirmArrival: () => act(() => api.post(`${base}/arrival`)),
      recordFinalCheckIn: (note: string) => act(() => api.post(`${base}/final-check-in`, { note })),

      /* ---------- Counsellor override ---------- */
      setOverride: (code: ServiceCode, status: ServiceStatus | null, reason: string) => act(() => api.put(`${base}/overrides/${code}`, { status, reason })),
    };
  }, [studentId]);
}

export type StudentActions = ReturnType<typeof useStudentActions>;
