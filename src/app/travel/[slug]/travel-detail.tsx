'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckIcon,
  CloseIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon
} from '@/components/icons';
import { TripMap } from '@/components/map/trip-map';
import { formatBytes, formatDate, formatTime } from '@/lib/format';
import type {
  Trip,
  TripAttachmentSummary,
  TripEntry,
  TripPlanItem,
  TripReservation
} from '@/lib/types';
import detailStyles from './travel-detail.module.css';

type Phase = 'before' | 'during' | 'after';

const phaseLabels: Record<Phase, string> = {
  before: '出发前',
  during: '在路上',
  after: '回来后'
};

const reservationLabels: Record<TripReservation['type'], string> = {
  transport: '交通',
  stay: '住宿',
  activity: '活动'
};

const planTypeLabels: Record<TripPlanItem['type'], string> = {
  place: '地点',
  transport: '交通',
  stay: '住宿',
  activity: '活动',
  note: '备注'
};

function clientId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function phaseForStatus(status: Trip['status']): Phase {
  if (status === 'active') return 'during';
  if (status === 'completed' || status === 'archived') return 'after';
  return 'before';
}

function attachmentUrl(tripId: string, attachmentId: string) {
  return `/api/trips/${tripId}/attachments/${attachmentId}`;
}

function isImageAttachment(attachment: TripAttachmentSummary | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/'));
}

function coordinate(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitList(value: string) {
  return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
}

export function TravelDetail({
  initialTrip,
  initialAttachments,
  initialAdmin
}: {
  initialTrip: Trip;
  initialAttachments: TripAttachmentSummary[];
  initialAdmin: boolean;
}) {
  const [trip, setTrip] = useState(initialTrip);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [phase, setPhase] = useState<Phase>(phaseForStatus(initialTrip.status));
  const [selectedDayId, setSelectedDayId] = useState(initialTrip.days[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedPointId, setSelectedPointId] = useState('');
  const [location, setLocation] = useState<{ lat?: number; lng?: number; label: string }>({ label: '' });
  const [recapIntro, setRecapIntro] = useState(initialTrip.recap?.intro ?? '');

  const [planDraft, setPlanDraft] = useState({
    title: '',
    type: 'place' as TripPlanItem['type'],
    time: '',
    locationName: '',
    note: '',
    lat: '',
    lng: '',
    url: ''
  });
  const [checklistDraft, setChecklistDraft] = useState('');
  const [reservationDraft, setReservationDraft] = useState({
    title: '',
    type: 'transport' as TripReservation['type'],
    provider: '',
    startAt: '',
    endAt: '',
    locationName: '',
    confirmationCode: '',
    url: ''
  });
  const [entryText, setEntryText] = useState('');
  const [entryFile, setEntryFile] = useState<File | null>(null);

  const [editingItemId, setEditingItemId] = useState('');
  const [itemDraft, setItemDraft] = useState({
    title: '',
    type: 'place' as TripPlanItem['type'],
    time: '',
    locationName: '',
    note: '',
    lat: '',
    lng: '',
    url: ''
  });
  const [editingReservationId, setEditingReservationId] = useState('');
  const [reservationEdit, setReservationEdit] = useState({
    title: '',
    type: 'transport' as TripReservation['type'],
    provider: '',
    startAt: '',
    endAt: '',
    locationName: '',
    confirmationCode: '',
    url: ''
  });
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    title: '',
    summary: '',
    destinations: '',
    startDate: '',
    endDate: '',
    tags: ''
  });
  const [editingDayId, setEditingDayId] = useState('');
  const [dayTitleDraft, setDayTitleDraft] = useState('');

  useEffect(() => {
    if (trip.days.some((day) => day.id === selectedDayId) === false) {
      setSelectedDayId(trip.days[0]?.id ?? '');
    }
  }, [selectedDayId, trip.days]);

  useEffect(() => {
    setRecapIntro(trip.recap?.intro ?? '');
  }, [trip.id, trip.recap?.intro]);

  const attachmentsById = useMemo(
    () => new Map(attachments.map((attachment) => [attachment.id, attachment])),
    [attachments]
  );
  const mapPoints = useMemo(
    () => [
      ...trip.days.flatMap((day) =>
        day.items.flatMap((item) =>
          typeof item.lat === 'number' && typeof item.lng === 'number'
            ? [{ id: item.id, label: item.locationName || item.title, lat: item.lat, lng: item.lng }]
            : []
        )
      ),
      ...trip.entries.flatMap((entry) =>
        typeof entry.lat === 'number' && typeof entry.lng === 'number'
          ? [{ id: entry.id, label: entry.locationName || '记录地点', lat: entry.lat, lng: entry.lng }]
          : []
      )
    ],
    [trip.days, trip.entries]
  );
  const numberById = useMemo(
    () => new Map(mapPoints.map((point, index) => [point.id, index + 1])),
    [mapPoints]
  );
  const checklistStats = useMemo(() => {
    const all = trip.days.flatMap((day) => day.checklist);
    return { total: all.length, completed: all.filter((item) => item.completed).length };
  }, [trip.days]);

  function badgeFor(id: string) {
    const number = numberById.get(id);
    if (!number) return null;
    return (
      <button
        className={detailStyles.itemBadge}
        type="button"
        title={`地图上的 ${number} 号点`}
        onClick={(event) => {
          event.stopPropagation();
          setSelectedPointId(id);
        }}
      >
        {number}
      </button>
    );
  }

  function handleSelectPoint(id: string) {
    setSelectedPointId(id);
    if (id) {
      document.getElementById(`trip-point-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function pointRowProps(id: string, baseClass: string) {
    if (!numberById.has(id)) return { id: `trip-point-${id}`, className: baseClass };
    const active = selectedPointId === id;
    return {
      id: `trip-point-${id}`,
      className: `${baseClass} ${detailStyles.pointLink}${active ? ` ${detailStyles.pointActive}` : ''}`,
      onClick: () => handleSelectPoint(id)
    };
  }

  async function handleMovePoint(id: string, lat: number, lng: number) {
    if (trip.days.some((day) => day.items.some((item) => item.id === id))) {
      const days = trip.days.map((day) => ({
        ...day,
        items: day.items.map((item) => (item.id === id ? { ...item, lat, lng } : item))
      }));
      await saveTrip({ days });
      return;
    }
    if (trip.entries.some((entry) => entry.id === id)) {
      const entries = trip.entries.map((entry) => (entry.id === id ? { ...entry, lat, lng } : entry));
      await saveTrip({ entries });
    }
  }

  async function saveTrip(patch: Partial<Trip>) {
    setBusy(true);
    setError('');
    const response = await fetch(`/api/trips/${trip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const payload = (await response.json().catch(() => null)) as { data?: Trip; error?: string } | null;
    setBusy(false);
    if (!response.ok || !payload?.data) {
      setError(payload?.error ?? '保存失败，请稍后重试。');
      return null;
    }
    setTrip(payload.data);
    if (patch.status) setPhase(phaseForStatus(payload.data.status));
    return payload.data;
  }

  async function uploadAttachment(file: File, kind: 'media' | 'reservation', reservationId?: string) {
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (reservationId) form.append('reservationId', reservationId);
    const response = await fetch(`/api/trips/${trip.id}/attachments`, {
      method: 'POST',
      body: form
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: TripAttachmentSummary;
      error?: string;
    } | null;
    setBusy(false);
    if (!response.ok || !payload?.data) {
      setError(payload?.error ?? '文件上传失败，请稍后重试。');
      return null;
    }
    setAttachments((current) => [...current, payload.data as TripAttachmentSummary]);
    return payload.data as TripAttachmentSummary;
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const attachment = await uploadAttachment(file, 'media');
    if (attachment) await saveTrip({ coverAttachmentId: attachment.id });
  }

  function updateDay(dayId: string, updater: (day: Trip['days'][number]) => Trip['days'][number]) {
    return trip.days.map((day) => (day.id === dayId ? updater(day) : day));
  }

  function readCoordinates(draft: { lat: string; lng: string }) {
    const lat = coordinate(draft.lat);
    const lng = coordinate(draft.lng);
    if ((draft.lat.trim() && lat === undefined) || (draft.lng.trim() && lng === undefined)) {
      setError('经纬度需要填写有效数字。');
      return null;
    }
    if ((lat === undefined) !== (lng === undefined)) {
      setError('经纬度需要成对填写。');
      return null;
    }
    return { lat, lng };
  }

  async function addPlanItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDayId || !planDraft.title.trim()) return;
    const coords = readCoordinates(planDraft);
    if (!coords) return;

    const item: TripPlanItem = {
      id: clientId('plan'),
      title: planDraft.title.trim(),
      type: planDraft.type,
      time: planDraft.time.trim() || undefined,
      locationName: planDraft.locationName.trim() || undefined,
      note: planDraft.note.trim() || undefined,
      lat: coords.lat,
      lng: coords.lng,
      url: planDraft.url.trim() || undefined
    };
    const days = updateDay(selectedDayId, (day) => ({ ...day, items: [...day.items, item] }));
    if (await saveTrip({ days })) {
      setPlanDraft({ title: '', type: 'place', time: '', locationName: '', note: '', lat: '', lng: '', url: '' });
    }
  }

  function startEditItem(item: TripPlanItem) {
    setEditingItemId(item.id);
    setItemDraft({
      title: item.title,
      type: item.type,
      time: item.time ?? '',
      locationName: item.locationName ?? '',
      note: item.note ?? '',
      lat: typeof item.lat === 'number' ? String(item.lat) : '',
      lng: typeof item.lng === 'number' ? String(item.lng) : '',
      url: item.url ?? ''
    });
  }

  async function saveItemEdit(dayId: string) {
    const current = trip.days.flatMap((day) => day.items).find((item) => item.id === editingItemId);
    if (!current || !itemDraft.title.trim()) return;
    const coords = readCoordinates(itemDraft);
    if (!coords) return;

    const updated: TripPlanItem = {
      ...current,
      title: itemDraft.title.trim(),
      type: itemDraft.type,
      time: itemDraft.time.trim() || undefined,
      locationName: itemDraft.locationName.trim() || undefined,
      note: itemDraft.note.trim() || undefined,
      lat: coords.lat,
      lng: coords.lng,
      url: itemDraft.url.trim() || undefined
    };
    const days = updateDay(dayId, (day) => ({
      ...day,
      items: day.items.map((item) => (item.id === updated.id ? updated : item))
    }));
    if (await saveTrip({ days })) setEditingItemId('');
  }

  async function deletePlanItem(dayId: string, itemId: string) {
    if (window.confirm('删除这条行程安排？') === false) return;
    const days = updateDay(dayId, (day) => ({
      ...day,
      items: day.items.filter((item) => item.id !== itemId)
    }));
    await saveTrip({ days });
  }

  async function toggleChecklist(dayId: string, itemId: string) {
    const days = updateDay(dayId, (day) => ({
      ...day,
      checklist: day.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    }));
    await saveTrip({ days });
  }

  async function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDayId || !checklistDraft.trim()) return;
    const days = updateDay(selectedDayId, (day) => ({
      ...day,
      checklist: [
        ...day.checklist,
        { id: clientId('check'), label: checklistDraft.trim(), completed: false }
      ]
    }));
    if (await saveTrip({ days })) setChecklistDraft('');
  }

  async function deleteChecklistItem(dayId: string, itemId: string) {
    const days = updateDay(dayId, (day) => ({
      ...day,
      checklist: day.checklist.filter((item) => item.id !== itemId)
    }));
    await saveTrip({ days });
  }

  async function addReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservationDraft.title.trim()) return;
    const reservation: TripReservation = {
      id: clientId('reservation'),
      type: reservationDraft.type,
      title: reservationDraft.title.trim(),
      provider: reservationDraft.provider.trim() || undefined,
      startAt: reservationDraft.startAt || undefined,
      endAt: reservationDraft.endAt || undefined,
      locationName: reservationDraft.locationName.trim() || undefined,
      confirmationCode: reservationDraft.confirmationCode.trim() || undefined,
      url: reservationDraft.url.trim() || undefined,
      attachmentIds: []
    };
    if (await saveTrip({ reservations: [...trip.reservations, reservation] })) {
      setReservationDraft({ title: '', type: 'transport', provider: '', startAt: '', endAt: '', locationName: '', confirmationCode: '', url: '' });
    }
  }

  function startEditReservation(reservation: TripReservation) {
    setEditingReservationId(reservation.id);
    setReservationEdit({
      title: reservation.title,
      type: reservation.type,
      provider: reservation.provider ?? '',
      startAt: reservation.startAt ?? '',
      endAt: reservation.endAt ?? '',
      locationName: reservation.locationName ?? '',
      confirmationCode: reservation.confirmationCode ?? '',
      url: reservation.url ?? ''
    });
  }

  async function saveReservationEdit() {
    const current = trip.reservations.find((reservation) => reservation.id === editingReservationId);
    if (!current || !reservationEdit.title.trim()) return;
    const reservations = trip.reservations.map((reservation) =>
      reservation.id === current.id
        ? {
            ...reservation,
            type: reservationEdit.type,
            title: reservationEdit.title.trim(),
            provider: reservationEdit.provider.trim() || undefined,
            startAt: reservationEdit.startAt || undefined,
            endAt: reservationEdit.endAt || undefined,
            locationName: reservationEdit.locationName.trim() || undefined,
            confirmationCode: reservationEdit.confirmationCode.trim() || undefined,
            url: reservationEdit.url.trim() || undefined
          }
        : reservation
    );
    if (await saveTrip({ reservations })) setEditingReservationId('');
  }

  async function deleteReservation(reservationId: string) {
    if (window.confirm('删除这条预订记录？已上传的附件仍保留在文件库中。') === false) return;
    await saveTrip({ reservations: trip.reservations.filter((reservation) => reservation.id !== reservationId) });
  }

  function startMetaEdit() {
    setMetaDraft({
      title: trip.title,
      summary: trip.summary,
      destinations: trip.destinations.join('，'),
      startDate: trip.startDate,
      endDate: trip.endDate,
      tags: trip.tags.join('，')
    });
    setMetaEditing(true);
  }

  async function saveMeta() {
    if (!metaDraft.title.trim()) {
      setError('标题不能为空。');
      return;
    }
    const saved = await saveTrip({
      title: metaDraft.title.trim(),
      summary: metaDraft.summary.trim(),
      destinations: splitList(metaDraft.destinations),
      tags: splitList(metaDraft.tags),
      startDate: metaDraft.startDate,
      endDate: metaDraft.endDate
    });
    if (saved) setMetaEditing(false);
  }

  async function saveDayTitle(dayId: string) {
    const days = updateDay(dayId, (day) => ({ ...day, title: dayTitleDraft.trim() }));
    if (await saveTrip({ days })) setEditingDayId('');
  }

  async function handleReservationFile(reservationId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const attachment = await uploadAttachment(file, 'reservation', reservationId);
    if (!attachment) return;
    const reservations = trip.reservations.map((reservation) =>
      reservation.id === reservationId
        ? { ...reservation, attachmentIds: [...new Set([...reservation.attachmentIds, attachment.id])] }
        : reservation
    );
    await saveTrip({ reservations });
  }

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setError('当前浏览器不支持定位，请使用 EXIF 或手动选点。');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: '当前位置'
        });
      },
      () => setError('没有获得定位权限，可以继续使用文字记录或手动选点。'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryText.trim() && !entryFile) return;
    let attachment: TripAttachmentSummary | null = null;
    if (entryFile) {
      attachment = await uploadAttachment(entryFile, 'media');
      if (!attachment) return;
    }

    const entry: TripEntry = {
      id: clientId('entry'),
      dayId: selectedDayId || undefined,
      createdAt: new Date().toISOString(),
      type: attachment ? 'photo' : 'note',
      text: entryText.trim() || undefined,
      attachmentIds: attachment ? [attachment.id] : [],
      locationName: location.label || undefined,
      lat: location.lat,
      lng: location.lng,
      visibility: 'public'
    };
    if (await saveTrip({ entries: [...trip.entries, entry] })) {
      setEntryText('');
      setEntryFile(null);
    }
  }

  async function saveRecap() {
    await saveTrip({ recap: { ...trip.recap, intro: recapIntro.trim() || undefined, pdfEnabled: true } });
  }

  async function togglePublic() {
    if (trip.status !== 'completed') return;
    if (trip.visibility === 'private' && window.confirm('公开后，旅行回顾和现场照片会对访客可见，预订材料仍保持私密。继续吗？') === false) return;
    await saveTrip({ visibility: trip.visibility === 'public' ? 'private' : 'public' });
  }

  const cover = trip.coverAttachmentId
    && isImageAttachment(attachmentsById.get(trip.coverAttachmentId))
    ? attachmentUrl(trip.id, trip.coverAttachmentId)
    : '/photos/photo-01.png';
  const canEdit = initialAdmin;

  return (
    <>
      <Link className={detailStyles.back} href="/travel">
        <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />
        返回旅行索引
      </Link>

      <header className={`${detailStyles.hero} reveal`}>
        <div className={detailStyles.heroImage}>
          <img src={cover} alt="" />
          {canEdit ? (
            <label className={detailStyles.coverUpload}>
              <UploadIcon size={14} />
              更换封面
              <input type="file" accept="image/*" onChange={handleCoverUpload} />
            </label>
          ) : null}
        </div>
        <div className={detailStyles.heroBody}>
          <p className="eyebrow">06 · {trip.status === 'planning' ? 'Planning' : trip.status === 'active' ? 'On the road' : 'Memory'}</p>
          <h1 className={detailStyles.title}>{trip.title}</h1>
          <p className={detailStyles.summary}>{trip.summary || '还没有写下这次旅行的说明。'}</p>
          <div className={detailStyles.metaLine}>
            <span>{trip.destinations.length > 0 ? trip.destinations.join(' · ') : '目的地待定'}</span>
            <span>{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span>
            <span>{trip.visibility === 'public' ? '公开回顾' : '私密计划'}</span>
            {canEdit ? (
              <button className={detailStyles.textButton} type="button" onClick={startMetaEdit}>
                编辑旅行信息
              </button>
            ) : null}
          </div>
          {trip.tags.length > 0 ? (
            <div className={detailStyles.tags}>{trip.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
          ) : null}
        </div>
        <aside className={detailStyles.heroAside}>
          <span className={detailStyles.status}>{trip.status === 'planning' ? '准备中' : trip.status === 'active' ? '进行中 · 私密' : trip.status === 'completed' ? '已完成' : '已归档'}</span>
          <strong>{trip.days.length} 天</strong>
          <span>{trip.days.reduce((total, day) => total + day.items.length, 0)} 个行程安排</span>
          <span>{checklistStats.completed}/{checklistStats.total || 0} 项准备完成</span>
        </aside>
      </header>

      {metaEditing ? (
        <div className={detailStyles.metaForm}>
          <label className="field"><span className="field__label">标题</span><input className="input" value={metaDraft.title} onChange={(event) => setMetaDraft({ ...metaDraft, title: event.target.value })} /></label>
          <label className="field"><span className="field__label">摘要</span><textarea className="textarea" value={metaDraft.summary} onChange={(event) => setMetaDraft({ ...metaDraft, summary: event.target.value })} placeholder="一句话说明这次旅行" /></label>
          <div className={detailStyles.twoFields}>
            <label className="field"><span className="field__label">目的地（顿号或逗号分隔）</span><input className="input" value={metaDraft.destinations} onChange={(event) => setMetaDraft({ ...metaDraft, destinations: event.target.value })} placeholder="天门" /></label>
            <label className="field"><span className="field__label">标签（顿号或逗号分隔）</span><input className="input" value={metaDraft.tags} onChange={(event) => setMetaDraft({ ...metaDraft, tags: event.target.value })} placeholder="自驾、博物馆" /></label>
          </div>
          <div className={detailStyles.twoFields}>
            <label className="field"><span className="field__label">开始日期</span><input className="input" type="date" value={metaDraft.startDate} onChange={(event) => setMetaDraft({ ...metaDraft, startDate: event.target.value })} /></label>
            <label className="field"><span className="field__label">结束日期</span><input className="input" type="date" value={metaDraft.endDate} onChange={(event) => setMetaDraft({ ...metaDraft, endDate: event.target.value })} /></label>
          </div>
          <div className={detailStyles.editFormActions}>
            <button className="btn btn--primary btn--small" type="button" onClick={saveMeta} disabled={busy}><CheckIcon size={13} />保存信息</button>
            <button className="btn btn--small" type="button" onClick={() => setMetaEditing(false)}>取消</button>
          </div>
        </div>
      ) : null}

      <div className={detailStyles.phaseBar} role="tablist" aria-label="旅行阶段">
        {(['before', 'during', 'after'] as Phase[]).map((item) => (
          <button
            className={phase === item ? detailStyles.phaseActive : detailStyles.phase}
            key={item}
            type="button"
            role="tab"
            aria-selected={phase === item}
            onClick={() => setPhase(item)}
          >
            <span>0{(['before', 'during', 'after'] as Phase[]).indexOf(item) + 1}</span>
            {phaseLabels[item]}
          </button>
        ))}
      </div>

      {canEdit ? (
        <div className={detailStyles.actionBar}>
          <span>{trip.status === 'active' ? '进行中的内容不会出现在公开主页。' : trip.status === 'planning' ? '计划和预订材料默认私密。' : trip.visibility === 'public' ? '这段旅行已经公开。' : '回顾还没有公开。'}</span>
          <div>
            {trip.status === 'planning' ? <button className="btn btn--primary btn--small" type="button" onClick={() => saveTrip({ status: 'active' })} disabled={busy}>开始旅行 <ArrowUpRight size={13} /></button> : null}
            {trip.status === 'active' ? <button className="btn btn--primary btn--small" type="button" onClick={() => saveTrip({ status: 'completed' })} disabled={busy}>结束旅行 <ArrowUpRight size={13} /></button> : null}
            {trip.status === 'completed' ? <button className="btn btn--small" type="button" onClick={togglePublic} disabled={busy}>{trip.visibility === 'public' ? '设为私密' : '公开回顾'}</button> : null}
          </div>
        </div>
      ) : null}

      {phase === 'before' ? (
        <section className={detailStyles.phaseSection}>
          <div className={detailStyles.sectionIntro}>
            <div>
              <p className="eyebrow">Before departure</p>
              <h2>先把这段路安排清楚。</h2>
            </div>
            <p>行程、清单和预订材料集中在这里。完成后再切换到“在路上”。</p>
          </div>

          <div className={detailStyles.planningGrid}>
            <div className={detailStyles.planColumn}>
              <div className={detailStyles.blockHead}><h3>每日行程</h3><span>{trip.days.length} DAYS</span></div>
              {canEdit ? (
                <form className={detailStyles.inlineForm} onSubmit={addPlanItem}>
                  <label className="field"><span className="field__label">加入哪一天</span><select className="select" value={selectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>{trip.days.map((day, index) => <option key={day.id} value={day.id}>第 {index + 1} 天 · {formatDate(day.date)}</option>)}</select></label>
                  <label className="field"><span className="field__label">安排</span><input className="input" value={planDraft.title} onChange={(event) => setPlanDraft({ ...planDraft, title: event.target.value })} placeholder="要去哪里，或要做什么" required /></label>
                  <div className={detailStyles.twoFields}>
                    <label className="field"><span className="field__label">类型</span><select className="select" value={planDraft.type} onChange={(event) => setPlanDraft({ ...planDraft, type: event.target.value as TripPlanItem['type'] })}>{Object.entries(planTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="field"><span className="field__label">时间</span><input className="input" value={planDraft.time} onChange={(event) => setPlanDraft({ ...planDraft, time: event.target.value })} placeholder="09:30" /></label>
                  </div>
                  <div className={detailStyles.twoFields}>
                    <label className="field"><span className="field__label">地点名称</span><input className="input" value={planDraft.locationName} onChange={(event) => setPlanDraft({ ...planDraft, locationName: event.target.value })} placeholder="地址或地标" /></label>
                    <label className="field"><span className="field__label">外部链接</span><input className="input" type="url" value={planDraft.url} onChange={(event) => setPlanDraft({ ...planDraft, url: event.target.value })} placeholder="可选" /></label>
                  </div>
                  <div className={detailStyles.twoFields}>
                    <label className="field"><span className="field__label">纬度</span><input className="input" inputMode="decimal" value={planDraft.lat} onChange={(event) => setPlanDraft({ ...planDraft, lat: event.target.value })} placeholder="30.25" /></label>
                    <label className="field"><span className="field__label">经度</span><input className="input" inputMode="decimal" value={planDraft.lng} onChange={(event) => setPlanDraft({ ...planDraft, lng: event.target.value })} placeholder="120.14" /></label>
                  </div>
                  <label className="field"><span className="field__label">备注</span><textarea className="textarea" value={planDraft.note} onChange={(event) => setPlanDraft({ ...planDraft, note: event.target.value })} placeholder="开放时间、想吃的东西、需要注意的事" /></label>
                  <button className="btn btn--primary btn--small" type="submit" disabled={busy}><PlusIcon size={13} />加入行程</button>
                </form>
              ) : null}

              <div className={detailStyles.dayList}>
                {trip.days.map((day, index) => (
                  <article className={detailStyles.day} key={day.id}>
                    <div className={detailStyles.dayHead}>
                      <span>DAY {String(index + 1).padStart(2, '0')}</span>
                      <strong>{formatDate(day.date)}</strong>
                      {canEdit ? (
                        <button
                          className={detailStyles.textButton}
                          type="button"
                          onClick={() => {
                            setEditingDayId(day.id);
                            setDayTitleDraft(day.title ?? '');
                          }}
                        >
                          改标题
                        </button>
                      ) : null}
                    </div>
                    {editingDayId === day.id ? (
                      <div className={detailStyles.dayTitleRow}>
                        <input className="input" value={dayTitleDraft} onChange={(event) => setDayTitleDraft(event.target.value)} placeholder="这一天的小标题" />
                        <button className="btn btn--small" type="button" onClick={() => saveDayTitle(day.id)} disabled={busy}><CheckIcon size={13} /></button>
                        <button className="btn btn--small" type="button" onClick={() => setEditingDayId('')}><CloseIcon size={13} /></button>
                      </div>
                    ) : day.title ? <p className={detailStyles.dayTitle}>{day.title}</p> : null}
                    {day.items.length > 0 ? day.items.map((item) => (
                      editingItemId === item.id ? (
                        <div className={detailStyles.editForm} key={item.id}>
                          <label className="field"><span className="field__label">安排</span><input className="input" value={itemDraft.title} onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} /></label>
                          <div className={detailStyles.twoFields}>
                            <label className="field"><span className="field__label">类型</span><select className="select" value={itemDraft.type} onChange={(event) => setItemDraft({ ...itemDraft, type: event.target.value as TripPlanItem['type'] })}>{Object.entries(planTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                            <label className="field"><span className="field__label">时间</span><input className="input" value={itemDraft.time} onChange={(event) => setItemDraft({ ...itemDraft, time: event.target.value })} placeholder="09:30" /></label>
                          </div>
                          <div className={detailStyles.twoFields}>
                            <label className="field"><span className="field__label">地点名称</span><input className="input" value={itemDraft.locationName} onChange={(event) => setItemDraft({ ...itemDraft, locationName: event.target.value })} /></label>
                            <label className="field"><span className="field__label">外部链接</span><input className="input" type="url" value={itemDraft.url} onChange={(event) => setItemDraft({ ...itemDraft, url: event.target.value })} placeholder="可选" /></label>
                          </div>
                          <div className={detailStyles.twoFields}>
                            <label className="field"><span className="field__label">纬度</span><input className="input" inputMode="decimal" value={itemDraft.lat} onChange={(event) => setItemDraft({ ...itemDraft, lat: event.target.value })} /></label>
                            <label className="field"><span className="field__label">经度</span><input className="input" inputMode="decimal" value={itemDraft.lng} onChange={(event) => setItemDraft({ ...itemDraft, lng: event.target.value })} /></label>
                          </div>
                          <label className="field"><span className="field__label">备注</span><textarea className="textarea" value={itemDraft.note} onChange={(event) => setItemDraft({ ...itemDraft, note: event.target.value })} /></label>
                          <div className={detailStyles.editFormActions}>
                            <button className="btn btn--primary btn--small" type="button" onClick={() => saveItemEdit(day.id)} disabled={busy}><CheckIcon size={13} />保存</button>
                            <button className="btn btn--small" type="button" onClick={() => setEditingItemId('')}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} {...pointRowProps(item.id, detailStyles.planItem)}>
                          <span className={detailStyles.itemTime}>{badgeFor(item.id)}{item.time || '—'}</span>
                          <div><strong>{item.title}</strong><span>{planTypeLabels[item.type]}{item.locationName ? ` · ${item.locationName}` : ''}</span>{item.note ? <p>{item.note}</p> : null}</div>
                          <div className={detailStyles.itemActions} onClick={(event) => event.stopPropagation()}>
                            {item.url ? <a href={item.url} target="_blank" rel="noreferrer" aria-label="打开链接"><ArrowUpRight size={13} /></a> : null}
                            {canEdit ? <button type="button" onClick={() => startEditItem(item)}>编辑</button> : null}
                            {canEdit ? <button type="button" onClick={() => deletePlanItem(day.id, item.id)} aria-label="删除"><TrashIcon size={12} /></button> : null}
                          </div>
                        </div>
                      )
                    )) : <p className={detailStyles.placeholder}>这一天还没有安排。</p>}
                  </article>
                ))}
              </div>
            </div>

            <aside className={detailStyles.sideColumn}>
              <div className={`${detailStyles.mapBlock} ${detailStyles.mapSticky}`}>
                <div className={detailStyles.blockHead}><h3>计划地图</h3><span>{mapPoints.length} POINTS</span></div>
                <TripMap
                  points={mapPoints}
                  editable={canEdit}
                  selectedId={selectedPointId}
                  onSelectPoint={handleSelectPoint}
                  onMovePoint={handleMovePoint}
                />
              </div>
            </aside>
          </div>

          <div className={detailStyles.prepGrid}>
              <div className={detailStyles.sideBlock}>
                <div className={detailStyles.blockHead}><h3>准备清单</h3><span>{checklistStats.completed}/{checklistStats.total}</span></div>
                {canEdit ? <form className={detailStyles.compactForm} onSubmit={addChecklist}><select className="select" value={selectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>{trip.days.map((day, index) => <option key={day.id} value={day.id}>第 {index + 1} 天</option>)}</select><div className={detailStyles.addLine}><input className="input" value={checklistDraft} onChange={(event) => setChecklistDraft(event.target.value)} placeholder="添加一项准备事项" /><button className="btn btn--small" type="submit" aria-label="添加清单"><PlusIcon size={13} /></button></div></form> : null}
                <div className={detailStyles.checklist}>{trip.days.flatMap((day) => day.checklist.map((item) => ({ ...item, dayId: day.id }))).map((item) => <label className={detailStyles.checkItem} key={item.id}><input type="checkbox" checked={item.completed} onChange={() => canEdit && toggleChecklist(item.dayId, item.id)} disabled={!canEdit} /><span className={item.completed ? detailStyles.checked : ''}>{item.label}</span>{canEdit ? <button className={detailStyles.checkDelete} type="button" onClick={(event) => { event.preventDefault(); deleteChecklistItem(item.dayId, item.id); }} aria-label="删除清单项"><CloseIcon size={11} /></button> : null}</label>)}</div>
                {checklistStats.total === 0 ? <p className={detailStyles.placeholder}>把证件、设备和行李写下来。</p> : null}
              </div>

              <div className={detailStyles.sideBlock}>
                <div className={detailStyles.blockHead}><h3>预订材料</h3><span>{trip.reservations.length} ITEMS</span></div>
                {canEdit ? <form className={detailStyles.reservationForm} onSubmit={addReservation}><label className="field"><span className="field__label">名称</span><input className="input" value={reservationDraft.title} onChange={(event) => setReservationDraft({ ...reservationDraft, title: event.target.value })} placeholder="航班、酒店或门票" required /></label><div className={detailStyles.twoFields}><label className="field"><span className="field__label">类型</span><select className="select" value={reservationDraft.type} onChange={(event) => setReservationDraft({ ...reservationDraft, type: event.target.value as TripReservation['type'] })}>{Object.entries(reservationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span className="field__label">服务商</span><input className="input" value={reservationDraft.provider} onChange={(event) => setReservationDraft({ ...reservationDraft, provider: event.target.value })} placeholder="可选" /></label></div><div className={detailStyles.twoFields}><label className="field"><span className="field__label">开始</span><input className="input" type="datetime-local" value={reservationDraft.startAt} onChange={(event) => setReservationDraft({ ...reservationDraft, startAt: event.target.value })} /></label><label className="field"><span className="field__label">结束</span><input className="input" type="datetime-local" value={reservationDraft.endAt} onChange={(event) => setReservationDraft({ ...reservationDraft, endAt: event.target.value })} /></label></div><label className="field"><span className="field__label">确认号</span><input className="input" value={reservationDraft.confirmationCode} onChange={(event) => setReservationDraft({ ...reservationDraft, confirmationCode: event.target.value })} placeholder="仅自己可见" /></label><button className="btn btn--small" type="submit" disabled={busy}><PlusIcon size={13} />添加预订记录</button></form> : null}
                <div className={detailStyles.reservationList}>{trip.reservations.map((reservation) => (
                  editingReservationId === reservation.id ? (
                    <div className={detailStyles.editForm} key={reservation.id}>
                      <label className="field"><span className="field__label">名称</span><input className="input" value={reservationEdit.title} onChange={(event) => setReservationEdit({ ...reservationEdit, title: event.target.value })} /></label>
                      <div className={detailStyles.twoFields}>
                        <label className="field"><span className="field__label">类型</span><select className="select" value={reservationEdit.type} onChange={(event) => setReservationEdit({ ...reservationEdit, type: event.target.value as TripReservation['type'] })}>{Object.entries(reservationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label className="field"><span className="field__label">服务商</span><input className="input" value={reservationEdit.provider} onChange={(event) => setReservationEdit({ ...reservationEdit, provider: event.target.value })} /></label>
                      </div>
                      <div className={detailStyles.twoFields}>
                        <label className="field"><span className="field__label">开始</span><input className="input" type="datetime-local" value={reservationEdit.startAt} onChange={(event) => setReservationEdit({ ...reservationEdit, startAt: event.target.value })} /></label>
                        <label className="field"><span className="field__label">结束</span><input className="input" type="datetime-local" value={reservationEdit.endAt} onChange={(event) => setReservationEdit({ ...reservationEdit, endAt: event.target.value })} /></label>
                      </div>
                      <div className={detailStyles.twoFields}>
                        <label className="field"><span className="field__label">地点</span><input className="input" value={reservationEdit.locationName} onChange={(event) => setReservationEdit({ ...reservationEdit, locationName: event.target.value })} /></label>
                        <label className="field"><span className="field__label">确认号</span><input className="input" value={reservationEdit.confirmationCode} onChange={(event) => setReservationEdit({ ...reservationEdit, confirmationCode: event.target.value })} /></label>
                      </div>
                      <label className="field"><span className="field__label">链接</span><input className="input" type="url" value={reservationEdit.url} onChange={(event) => setReservationEdit({ ...reservationEdit, url: event.target.value })} placeholder="可选" /></label>
                      <div className={detailStyles.editFormActions}>
                        <button className="btn btn--primary btn--small" type="button" onClick={saveReservationEdit} disabled={busy}><CheckIcon size={13} />保存</button>
                        <button className="btn btn--small" type="button" onClick={() => setEditingReservationId('')}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <article className={detailStyles.reservation} key={reservation.id}>
                      <div>
                        <span className={detailStyles.reservationType}>{reservationLabels[reservation.type]}</span>
                        <strong>{reservation.title}</strong>
                        <span>{[reservation.provider, reservation.locationName].filter(Boolean).join(' · ') || '材料待补充'}</span>
                        {canEdit ? (
                          <div className={detailStyles.reservationActions}>
                            <button type="button" onClick={() => startEditReservation(reservation)}>编辑</button>
                            <button type="button" onClick={() => deleteReservation(reservation.id)} aria-label="删除"><TrashIcon size={12} /></button>
                          </div>
                        ) : null}
                      </div>
                      <div className={detailStyles.reservationFiles}>{reservation.attachmentIds.map((id) => { const attachment = attachmentsById.get(id); return attachment ? <a href={attachmentUrl(trip.id, id)} key={id} target="_blank" rel="noreferrer">{attachment.originalName}</a> : null; })}{canEdit ? <label className={detailStyles.fileButton}><UploadIcon size={13} />上传文件<input type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => handleReservationFile(reservation.id, event)} /></label> : null}</div>
                    </article>
                  )
                ))}</div>
                {trip.reservations.length === 0 ? <p className={detailStyles.placeholder}>把确认邮件、票据或 PDF 放在对应项目下。</p> : null}
              </div>
          </div>
        </section>
      ) : null}

      {phase === 'during' ? (
        <section className={detailStyles.phaseSection}>
          <div className={detailStyles.sectionIntro}><div><p className="eyebrow">On the road</p><h2>只留下当时真的想记住的。</h2></div><p>进行中的旅行始终私密。定位只在你主动授权时读取，也可以随时不用。</p></div>
          {canEdit ? <form className={detailStyles.entryComposer} onSubmit={addEntry}><div className={detailStyles.composerTop}><label className="field"><span className="field__label">归入哪一天</span><select className="select" value={selectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>{trip.days.map((day, index) => <option key={day.id} value={day.id}>第 {index + 1} 天 · {formatDate(day.date)}</option>)}</select></label><button className="btn btn--small" type="button" onClick={getCurrentLocation}><MapPinIcon size={14} />{location.lat ? '已记录当前位置' : '使用当前位置'}</button></div><textarea className="textarea" value={entryText} onChange={(event) => setEntryText(event.target.value)} placeholder="写下此刻，几句话就够了。" /><div className={detailStyles.composerFooter}><label className={detailStyles.fileButton}><UploadIcon size={13} />{entryFile ? entryFile.name : '附上一张照片'}<input type="file" accept="image/*" onChange={(event) => setEntryFile(event.target.files?.[0] ?? null)} /></label><span className={detailStyles.locationNote}>{location.lat ? `${location.lat.toFixed(4)}, ${location.lng?.toFixed(4)}` : '未使用定位'}</span><button className="btn btn--primary btn--small" type="submit" disabled={busy || (!entryText.trim() && !entryFile)}>记一笔 <ArrowUpRight size={13} /></button></div></form> : null}
          <div className={detailStyles.duringGrid}>
          <div className={detailStyles.timeline}>{trip.entries.length > 0 ? [...trip.entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry) => <article key={entry.id} {...pointRowProps(entry.id, detailStyles.entry)}><div className={detailStyles.entryTime}>{badgeFor(entry.id)}<span>{formatDate(entry.createdAt)}</span><strong>{formatTime(entry.createdAt)}</strong></div><div className={detailStyles.entryBody}>{entry.text ? <p>{entry.text}</p> : null}{entry.locationName ? <span className={detailStyles.entryLocation}><MapPinIcon size={13} />{entry.locationName}</span> : null}{entry.attachmentIds?.map((id) => { const attachment = attachmentsById.get(id); if (!attachment) return null; return isImageAttachment(attachment) ? <img className={detailStyles.entryImage} src={attachmentUrl(trip.id, id)} alt={attachment.originalName} key={id} /> : <a className={detailStyles.entryFile} href={attachmentUrl(trip.id, id)} target="_blank" rel="noreferrer" key={id} onClick={(event) => event.stopPropagation()}>{attachment.originalName} · {formatBytes(attachment.size)}</a>; })}</div></article>) : <div className={detailStyles.emptyTimeline}>还没有沿途记录。等一个值得留下来的瞬间。</div>}</div>
            <div className={`${detailStyles.mapBlock} ${detailStyles.mapSticky}`}><div className={detailStyles.blockHead}><h3>沿途地点</h3><span>{mapPoints.length} POINTS</span></div><TripMap points={mapPoints} editable={canEdit} selectedId={selectedPointId} onSelectPoint={handleSelectPoint} onMovePoint={handleMovePoint} /></div>
          </div>
        </section>
      ) : null}

      {phase === 'after' ? (
        <section className={`${detailStyles.phaseSection} ${detailStyles.afterSection}`}>
          <div className={detailStyles.sectionIntro}><div><p className="eyebrow">After the journey</p><h2>回来以后，再决定怎样保存。</h2></div><p>回顾页由计划、地点和沿途记录组成。你可以继续保持私密，也可以公开给访客阅读。</p></div>
          <div className={detailStyles.recapGrid}><div><div className={detailStyles.blockHead}><h3>回顾引言</h3><span>{trip.entries.length} RECORDS</span></div>{canEdit ? <textarea className={detailStyles.recapInput} value={recapIntro} onChange={(event) => setRecapIntro(event.target.value)} placeholder="这次旅行后来留下了什么？" /> : <p className={detailStyles.recapText}>{trip.recap?.intro || '还没有写下回顾引言。'}</p>}{canEdit ? <div className={detailStyles.recapActions}><button className="btn btn--small" type="button" onClick={saveRecap} disabled={busy}><CheckIcon size={13} />保存回顾</button><button className="btn btn--small" type="button" onClick={() => window.print()}><ArrowUpRight size={13} />打印 / 导出 PDF</button></div> : null}</div><aside className={detailStyles.recapStats}><div><span>天数</span><strong>{trip.days.length}</strong></div><div><span>地点</span><strong>{mapPoints.length}</strong></div><div><span>记录</span><strong>{trip.entries.length}</strong></div><div><span>预订</span><strong>{trip.reservations.length}</strong></div></aside></div>
          <div className={detailStyles.afterGrid}>
          <div className={detailStyles.memoryList}><div className={detailStyles.blockHead}><h3>沿途记录</h3><span>EDITABLE TIMELINE</span></div>{trip.days.map((day, index) => { const entries = trip.entries.filter((entry) => entry.dayId === day.id); const items = day.items; return <article className={detailStyles.memoryDay} key={day.id}><div className={detailStyles.memoryDayHead}><span>DAY {String(index + 1).padStart(2, '0')}</span><strong>{formatDate(day.date)}</strong></div><div>{items.map((item) => <div key={item.id} {...pointRowProps(item.id, detailStyles.memoryItem)}><span>{badgeFor(item.id)}{item.time || '—'}</span><p><strong>{item.title}</strong>{item.locationName ? <small>{item.locationName}</small> : null}</p></div>)}{entries.map((entry) => <div key={entry.id} {...pointRowProps(entry.id, detailStyles.memoryEntry)}><span>{badgeFor(entry.id)}{formatTime(entry.createdAt)}</span><p>{entry.text || '一张照片'}{entry.locationName ? <small>{entry.locationName}</small> : null}</p></div>)}</div></article>; })}</div>
            <div className={`${detailStyles.mapBlock} ${detailStyles.mapSticky}`}><div className={detailStyles.blockHead}><h3>路线回看</h3><span>{mapPoints.length} POINTS</span></div><TripMap points={mapPoints} editable={canEdit} selectedId={selectedPointId} onSelectPoint={handleSelectPoint} onMovePoint={handleMovePoint} /></div>
          </div>
        </section>
      ) : null}

      {error ? <p className={detailStyles.error} role="status">{error}</p> : null}
    </>
  );
}
