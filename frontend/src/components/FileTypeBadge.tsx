import React from 'react';

const FILE_TYPES: Record<string, { label: string; color: string; bg: string; corner: string }> = {
  'application/pdf':                                                                    { label: 'PDF',  color: '#dc2626', bg: '#fff1f1', corner: '#fca5a5' },
  'application/msword':                                                                 { label: 'DOC',  color: '#2563eb', bg: '#eff6ff', corner: '#93c5fd' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':           { label: 'DOCX', color: '#2563eb', bg: '#eff6ff', corner: '#93c5fd' },
  'application/vnd.oasis.opendocument.text':                                           { label: 'ODT',  color: '#2563eb', bg: '#eff6ff', corner: '#93c5fd' },
  'application/vnd.oasis.opendocument.spreadsheet':                                    { label: 'ODS',  color: '#16a34a', bg: '#f0fdf4', corner: '#86efac' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                 { label: 'XLSX', color: '#16a34a', bg: '#f0fdf4', corner: '#86efac' },
  'application/vnd.oasis.opendocument.presentation':                                   { label: 'ODP',  color: '#d97706', bg: '#fffbeb', corner: '#fcd34d' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':         { label: 'PPTX', color: '#d97706', bg: '#fffbeb', corner: '#fcd34d' },
};

const SIZES = {
  sm: { w: 32, h: 38, r: 4,  fold: 9,  fs: 6,  lh: 18 },
  md: { w: 40, h: 48, r: 5,  fold: 11, fs: 7,  lh: 22 },
  lg: { w: 48, h: 58, r: 6,  fold: 13, fs: 8.5,lh: 27 },
};

interface Props { mimeType?: string; size?: 'sm' | 'md' | 'lg'; }

export default function FileTypeBadge({ mimeType, size = 'md' }: Props) {
  const t = mimeType ? FILE_TYPES[mimeType] : null;
  const s = SIZES[size];

  if (!t) {
    // Generic file icon
    return (
      <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`} fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <rect x="0" y="0" width={s.w - s.fold} height={s.h} rx={s.r} fill="#f3f4f6"/>
        <path d={`M${s.w - s.fold} 0 L${s.w} ${s.fold} L${s.w - s.fold} ${s.fold} Z`} fill="#d1d5db"/>
        <path d={`M${s.w - s.fold} 0 L${s.w - s.fold} ${s.fold} L${s.w} ${s.fold}`} fill="#e5e7eb" stroke="#d1d5db" strokeWidth="0.5"/>
        <text x={s.w / 2 - s.fold / 4} y={s.lh + s.fold} textAnchor="middle" fontSize={s.fs} fontWeight="700" fill="#9ca3af" fontFamily="system-ui,sans-serif">?</text>
      </svg>
    );
  }

  return (
    <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`} fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      {/* Body */}
      <rect x="0" y="0" width={s.w - s.fold} height={s.h} rx={s.r} fill={t.bg}/>
      <rect x={s.w - s.fold} y={s.fold} width={s.fold} height={s.h - s.fold} rx={0} fill={t.bg}/>
      <rect x={s.w - s.fold} y={s.fold} width={s.fold} height={s.h - s.fold - s.r}
        style={{ borderBottomRightRadius: s.r }} fill={t.bg}/>
      {/* Bottom-right rounded corner of full body */}
      <path d={`M0 ${s.r} Q0 0 ${s.r} 0 L${s.w - s.fold} 0 L${s.w} ${s.fold} L${s.w} ${s.h - s.r} Q${s.w} ${s.h} ${s.w - s.r} ${s.h} L${s.r} ${s.h} Q0 ${s.h} 0 ${s.h - s.r} Z`} fill={t.bg}/>
      {/* Fold triangle */}
      <path d={`M${s.w - s.fold} 0 L${s.w} ${s.fold} L${s.w - s.fold} ${s.fold} Z`} fill={t.corner}/>
      {/* Fold shadow line */}
      <path d={`M${s.w - s.fold} 0 L${s.w - s.fold} ${s.fold} L${s.w} ${s.fold}`} fill="none" stroke={t.corner} strokeWidth="0.5"/>
      {/* Color band at bottom */}
      <rect x="0" y={s.h - s.fold - 2} width={s.w} height={s.fold + 2}
        rx={s.r}
        fill={t.color}
        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}/>
      <rect x="0" y={s.h - s.fold - 2} width={s.w} height={4} fill={t.color}/>
      {/* Label text */}
      <text
        x={s.w / 2}
        y={s.h - 3}
        textAnchor="middle"
        fontSize={s.fs}
        fontWeight="800"
        fill="white"
        fontFamily="system-ui,sans-serif"
        letterSpacing="0.5"
      >{t.label}</text>
    </svg>
  );
}
