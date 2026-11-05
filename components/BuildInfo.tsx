'use client';
import { useEffect, useState } from 'react';
import { loadVersion } from '../lib/news';
import { formatBuild } from '../lib/version';
import type { VersionInfo } from '../lib/version';

/** 푸터의 작은 배포 버전 표시: "사이트 빌드 2026.11.05 14:02 · a1b2c3d". 읽지 못하면 아무것도 보이지 않는다. */
export default function BuildInfo() {
  const [v, setV] = useState<VersionInfo | null>(null);
  useEffect(() => { loadVersion().then(setV).catch(() => {}); }, []);
  if (!v) return null;
  return <p className="buildInfo">사이트 빌드 {formatBuild(v.built_at)} · {v.commit}</p>;
}
