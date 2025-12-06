import React, { useEffect, useState } from 'react';
import {
  getStats,
  getActiveVisits,
  subscribeToUpdates,
  getAllVisits,
  getAllVisitors,
  getSpacesWithOccupancy,
  checkOut,
  getAllPenalties,
  addPenalty,
  updatePenalty,
  getPrograms,
  createProgram,
  updateSpace,
  updateVisit,
  deleteVisit,
} from '../services/dataService';
import { DashboardStats, Visit, Visitor, Penalty, Program } from '../types';
import { analyzeTraffic } from '../services/geminiService';
import { Users, Clock, History, Download, Sparkles, RefreshCw, Activity, Search, LogOut, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LineChart, Line } from 'recharts';

const PURPOSE_LABEL_MAP: Record<string, string> = {
  'Study': '개인 학습',
  'Meeting': '회의/미팅',
  'Rest': '휴식',
  'Event': '행사 참여',
  'Other': '기타'
};

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [visitSearch, setVisitSearch] = useState('');
  const [visitDateFrom, setVisitDateFrom] = useState('');
  const [visitDateTo, setVisitDateTo] = useState('');
  const [spaces, setSpaces] = useState<{ id: string; name: string; capacity: number; currentOccupancy: number }[]>([]);
  const [forceCheckoutId, setForceCheckoutId] = useState<string | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [newProgramName, setNewProgramName] = useState('');
  const [updatingSpaceId, setUpdatingSpaceId] = useState<string | null>(null);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editingVisitCheckIn, setEditingVisitCheckIn] = useState('');
  const [editingVisitCheckOut, setEditingVisitCheckOut] = useState('');
  const [editingVisitPurpose, setEditingVisitPurpose] = useState<Visit['purpose'] | ''>('');
  const [editingVisitSpaceId, setEditingVisitSpaceId] = useState<string>('');

  const fetchData = async () => {
    const s = await getStats();
    const v = await getActiveVisits();
    const all = await getAllVisits();
    const m = await getAllVisitors();
    const sp = await getSpacesWithOccupancy();
    const p = await getAllPenalties();
    const prog = await getPrograms();
    setStats(s);
    setActiveVisits(v);
    setAllVisits(all);
    setVisitors(m);
    setSpaces(sp);
    setPenalties(p);
    setPrograms(prog);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = subscribeToUpdates(fetchData);
    const interval = setInterval(fetchData, 60000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const allVisits = await getAllVisits();
    const result = await analyzeTraffic(allVisits);
    setAiInsight(result);
    setLoadingAi(false);
  };

  const exportCSV = async () => {
    const visits = await getAllVisits();
    const headers = ['이름', '방문목적', '입실시간', '퇴실시간', '상태'];
    const csvContent = [
      headers.join(','),
      ...visits.map(v => 
        `"${v.visitor_name}","${PURPOSE_LABEL_MAP[v.purpose] || v.purpose}","${v.check_in_at}","${v.check_out_at || ''}","${v.status === 'active' ? '이용중' : '완료'}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `centerflow_log_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const chartData = activeVisits.reduce((acc, visit) => {
    const label = PURPOSE_LABEL_MAP[visit.purpose] || visit.purpose;
    const existing = acc.find(i => i.name === label);
    if (existing) { existing.value += 1; }
    else { acc.push({ name: label, value: 1 }); }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Last 7 days visit trend
  const dailyTrend = (() => {
    if (!allVisits.length) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach((v) => {
      const dateKey = new Date(v.check_in_at).toISOString().split('T')[0];
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    });
    const sortedDates = Object.keys(counts).sort();
    const lastDates = sortedDates.slice(-7);
    return lastDates.map((d) => ({
      date: d.slice(5), // MM-DD
      count: counts[d],
    }));
  })();

  const heatmapData = (() => {
    if (!allVisits.length) {
      return { rows: [] as { dayIndex: number; label: string; values: number[] }[], max: 0 };
    }
    const counts: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0),
    );
    allVisits.forEach((v) => {
      const date = new Date(v.check_in_at);
      const day = date.getDay(); // 0 (Sun) - 6 (Sat)
      const hour = date.getHours();
      counts[day][hour] += 1;
    });
    let max = 0;
    counts.forEach((row) =>
      row.forEach((value) => {
        if (value > max) max = value;
      }),
    );
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    const order = [1, 2, 3, 4, 5, 6, 0]; // 월~일 순
    const rows = order.map((dayIndex) => ({
      dayIndex,
      label: dayLabels[dayIndex],
      values: counts[dayIndex],
    }));
    return { rows, max };
  })();

  const filteredMembers = visitors.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.trim();
    return (
      m.name.includes(q) ||
      m.phone_number.includes(q)
    );
  });

  const totalCapacity = spaces.reduce((sum, s) => sum + (s.capacity || 0), 0);
  const occupancyPercent =
    totalCapacity > 0
      ? Math.min(100, Math.round((stats.currentOccupancy / totalCapacity) * 100))
      : 0;

  const filteredVisits = allVisits.filter((v) => {
    const q = visitSearch.trim();
    if (q) {
      const matchesText =
        v.visitor_name.includes(q) ||
        PURPOSE_LABEL_MAP[v.purpose]?.includes(q) ||
        v.purpose.includes(q);
      if (!matchesText) {
        return false;
      }
    }

    if (visitDateFrom) {
      const from = new Date(visitDateFrom);
      const visitDate = new Date(v.check_in_at);
      if (visitDate < from) return false;
    }

    if (visitDateTo) {
      const to = new Date(visitDateTo);
      const visitDate = new Date(v.check_in_at);
      // include same day
      to.setHours(23, 59, 59, 999);
      if (visitDate > to) return false;
    }

    return true;
  });

  const handleForceCheckout = async (visitId: string) => {
    try {
      setForceCheckoutId(visitId);
      await checkOut(visitId);
    } finally {
      setForceCheckoutId(null);
    }
  };

  const handleAddWarning = async (visitorId: string) => {
    const reason = window.prompt('경고 사유를 입력하세요 (예: 소란, 규정 위반 등)');
    if (!reason) return;
    await addPenalty(visitorId, 'warning', reason);
    const p = await getAllPenalties();
    setPenalties(p);
  };

  const handleSuspendVisitor = async (visitorId: string) => {
    const reason =
      window.prompt('이용 정지 사유를 입력하세요 (예: 반복 규정 위반 등)') ||
      '이용 정지';
    if (!reason) return;
    await addPenalty(visitorId, 'suspension', reason);
    const p = await getAllPenalties();
    setPenalties(p);
  };

  const handleLiftSuspension = async (visitorId: string) => {
    const confirmLift = window.confirm(
      '이 회원의 이용 정지를 해제하시겠습니까?',
    );
    if (!confirmLift) return;
    const visitorPenalties = penalties.filter(
      (p) => p.visitor_id === visitorId && p.type === 'suspension' && p.active,
    );
    if (!visitorPenalties.length) return;
    // 가장 최근 활성 정지 제재만 해제
    const latest = visitorPenalties[0];
    await updatePenalty(latest.id, { active: false });
    const p = await getAllPenalties();
    setPenalties(p);
  };

  const handleCreateProgram = async () => {
    if (!newProgramName.trim()) return;
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      9,
      0,
      0,
    ).toISOString();
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      18,
      0,
      0,
    ).toISOString();
    await createProgram({
      name: newProgramName.trim(),
      start_at: start,
      end_at: end,
    });
    setNewProgramName('');
    const prog = await getPrograms();
    setPrograms(prog);
  };

  const handleUpdateSpaceCapacity = async (spaceId: string, capacity: number) => {
    try {
      setUpdatingSpaceId(spaceId);
      await updateSpace(spaceId, { capacity });
      const sp = await getSpacesWithOccupancy();
      setSpaces(sp);
    } finally {
      setUpdatingSpaceId(null);
    }
  };

  const handleSaveVisitEdit = async () => {
    if (!editingVisit) return;
    try {
      const patch: Partial<Visit> = {};
      if (editingVisitCheckIn) {
        patch.check_in_at = new Date(editingVisitCheckIn).toISOString();
      }
      patch.check_out_at = editingVisitCheckOut
        ? new Date(editingVisitCheckOut).toISOString()
        : null;

      if (editingVisitPurpose) {
        patch.purpose = editingVisitPurpose;
      }
      if (editingVisitSpaceId) {
        patch.space_id = editingVisitSpaceId;
        const space = spaces.find((s) => s.id === editingVisitSpaceId);
        if (space) {
          patch.space_name = space.name;
        }
      } else {
        patch.space_id = undefined;
        patch.space_name = undefined;
      }

      await updateVisit(editingVisit.id, patch);
      const all = await getAllVisits();
      setAllVisits(all);
      setEditingVisit(null);
      setEditingVisitCheckIn('');
      setEditingVisitCheckOut('');
	    } catch (e) {
	      alert('방문 기록을 저장하는 중 오류가 발생했습니다.');
	    }
	  };

  const handleCancelVisitEdit = () => {
    setEditingVisit(null);
    setEditingVisitCheckIn('');
    setEditingVisitCheckOut('');
    setEditingVisitPurpose('');
    setEditingVisitSpaceId('');
  };

  const handleDeleteVisit = async (visitId: string) => {
    const ok = window.confirm('이 방문 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!ok) return;
    try {
      await deleteVisit(visitId);
      const all = await getAllVisits();
      setAllVisits(all);
    } catch (e) {
      alert('방문 기록을 삭제하는 중 오류가 발생했습니다.');
    }
  };

  if (!stats) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
          데이터를 불러오는 중...
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="text-brand-600" /> 관리자 대시보드
            </h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              실시간 데이터 수신 중 • 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchData} className="p-2.5 text-gray-500 hover:text-brand-600 bg-gray-50 hover:bg-brand-50 border border-gray-200 rounded-xl transition-colors">
              <RefreshCw size={20} />
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95 font-medium text-sm">
              <Download size={18} /> 엑셀 다운로드
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:border-brand-200 transition-colors relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-gray-500 mb-1">현재 이용자 수</p>
              <p className="text-4xl font-extrabold text-gray-900">{stats.currentOccupancy}<span className="text-lg font-medium text-gray-400 ml-1">명</span></p>
            </div>
            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:border-purple-200 transition-colors">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">일일 누적 방문</p>
              <p className="text-4xl font-extrabold text-gray-900">{stats.totalVisitsToday}<span className="text-lg font-medium text-gray-400 ml-1">건</span></p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <History size={28} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:border-orange-200 transition-colors">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">평균 이용 시간</p>
              <p className="text-4xl font-extrabold text-gray-900">{stats.averageDurationMinutes}<span className="text-lg font-medium text-gray-400 ml-1">분</span></p>
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-110 transition-transform">
              <Clock size={28} />
            </div>
          </div>
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-8">
             
             {/* AI Insights Section */}
            <div className="bg-gradient-to-br from-indigo-900 to-violet-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden ring-1 ring-white/10">
               <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
               <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 opacity-20 rounded-full blur-3xl"></div>
               
               <div className="relative z-10">
                 <div className="flex items-center justify-between mb-5">
                   <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                      <Sparkles className="text-yellow-300" size={20} fill="currentColor" /> AI 스마트 분석
                   </h3>
                   <button 
                    onClick={handleAiAnalysis} 
                    disabled={loadingAi}
                    className="text-xs bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 transition-all disabled:opacity-50 font-medium"
                   >
                     {loadingAi ? '분석 중입니다...' : '리포트 생성'}
                   </button>
                 </div>
                 
                 {aiInsight ? (
                   <div className="text-indigo-50 text-sm leading-relaxed whitespace-pre-line bg-black/20 p-5 rounded-xl border border-white/10 shadow-inner font-light">
                     {aiInsight}
                   </div>
                 ) : (
                   <p className="text-indigo-200 text-sm opacity-80 font-light bg-white/5 p-4 rounded-xl border border-white/5">
                     '리포트 생성' 버튼을 누르면 AI가 현재 방문 데이터를 분석하여<br/> 
                     혼잡 시간대 예측 및 운영 조언을 제공합니다.
                   </p>
                 )}
               </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                <h3 className="font-bold text-lg text-gray-800">실시간 입실 현황</h3>
                <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-md border border-green-200">Live</span>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                    <tr>
                      <th className="p-4 font-semibold tracking-wider w-1/4 pl-6">방문자 이름</th>
                      <th className="p-4 font-semibold tracking-wider w-1/4">방문 목적</th>
                      <th className="p-4 font-semibold tracking-wider w-1/4">입실 시간</th>
                      <th className="p-4 font-semibold tracking-wider w-1/4">이용 시간</th>
                      <th className="p-4 font-semibold tracking-wider w-[120px] pr-6 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {activeVisits.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-gray-400">현재 이용 중인 방문자가 없습니다.</td></tr>
                    ) : (
                      activeVisits.map((visit) => {
                        const durationMins = Math.round((new Date().getTime() - new Date(visit.check_in_at).getTime()) / 60000);
                        const label = PURPOSE_LABEL_MAP[visit.purpose] || visit.purpose;
                        const isProcessing = forceCheckoutId === visit.id;
                        return (
                          <tr key={visit.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="p-4 pl-6 font-bold text-gray-800">{visit.visitor_name}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold border border-gray-200 group-hover:bg-white group-hover:border-brand-200 group-hover:text-brand-600 transition-all">
                                {label}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500 font-mono text-xs">
                                {new Date(visit.check_in_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="p-4">
                                <span className="text-brand-600 font-bold">{durationMins}</span>
                                <span className="text-gray-400 text-xs ml-0.5">분</span>
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                type="button"
                                onClick={() => handleForceCheckout(visit.id)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white text-gray-700 border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <LogOut size={12} />
                                {isProcessing ? '처리 중' : '퇴장 처리'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visit history / logs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[420px]">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/30">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">방문 기록 조회</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    날짜와 이름/목적으로 최근 방문 내역을 확인합니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      value={visitSearch}
                      onChange={(e) => setVisitSearch(e.target.value)}
                      placeholder="이름 또는 목적"
                      className="bg-transparent text-xs outline-none placeholder:text-gray-400"
                    />
                  </div>
                  <input
                    type="date"
                    value={visitDateFrom}
                    onChange={(e) => setVisitDateFrom(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                  />
                  <span className="text-xs text-gray-400">~</span>
                  <input
                    type="date"
                    value={visitDateTo}
                    onChange={(e) => setVisitDateTo(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                  />
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="p-3 font-semibold w-1/5">이름</th>
                      <th className="p-3 font-semibold w-1/5">목적</th>
                      <th className="p-3 font-semibold w-1/5">입실</th>
                      <th className="p-3 font-semibold w-1/5">퇴실</th>
                      <th className="p-3 font-semibold w-1/5">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredVisits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-gray-400 text-xs"
                        >
                          조건에 맞는 방문 기록이 없습니다.
                        </td>
                      </tr>
                    ) : (
	                      filteredVisits.slice(0, 100).map((v) => {
	                        const label =
	                          PURPOSE_LABEL_MAP[v.purpose] || v.purpose;
	                        return (
	                          <tr
	                            key={v.id}
	                            className="hover:bg-gray-50 transition-colors"
	                          >
                            <td className="p-3 font-semibold">
                              {v.visitor_name}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[10px] font-semibold text-gray-700">
                                {label}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-gray-500">
                              {new Date(v.check_in_at).toLocaleString(
                                'ko-KR',
                                {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-gray-400">
                              {v.check_out_at
                                ? new Date(v.check_out_at).toLocaleString(
                                    'ko-KR',
                                    {
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    },
                                  )
                                : '-'}
                            </td>
	                            <td className="p-3">
	                              {v.status === 'active' ? (
	                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
	                                  이용중
	                                </span>
	                              ) : (
	                                <div className="flex items-center gap-1">
	                                  <button
	                                    type="button"
	                                    onClick={() => {
	                                      setEditingVisit(v);
	                                      setEditingVisitCheckIn(
	                                        v.check_in_at.slice(0, 16),
	                                      );
	                                      setEditingVisitCheckOut(
	                                        v.check_out_at
	                                          ? v.check_out_at.slice(0, 16)
	                                          : '',
	                                      );
	                                      setEditingVisitPurpose(v.purpose);
	                                      setEditingVisitSpaceId(
	                                        v.space_id || '',
	                                      );
	                                    }}
	                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors"
	                                  >
	                                    수정
	                                  </button>
	                                  <button
	                                    type="button"
	                                    onClick={() => handleDeleteVisit(v.id)}
	                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200 transition-colors"
	                                  >
	                                    삭제
	                                  </button>
	                                </div>
	                              )}
	                            </td>
	                          </tr>
	                        );
	                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-100">
                완료된 방문 기록의 목적, 공간, 입·퇴실 시간을 간단히 수정할 수 있습니다.
              </p>
            </div>
          </div>

          {/* Right Column: Charts & Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-96">
               <h3 className="font-bold text-lg text-gray-800 mb-6">목적별 이용 현황</h3>
               <div className="h-72 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} dy={10} />
                      <Tooltip 
                        cursor={{fill: '#f9fafb'}} 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-72">
               <h3 className="font-bold text-lg text-gray-800 mb-4">최근 7일 방문 추이</h3>
               <div className="h-52 w-full">
                 {dailyTrend.length === 0 ? (
                   <div className="h-full flex items-center justify-center text-xs text-gray-400">
                     방문 데이터가 충분하지 않습니다.
                   </div>
                 ) : (
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                       <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                       <Tooltip
                         cursor={{ stroke: '#e5e7eb' }}
                         contentStyle={{
                           borderRadius: '12px',
                           border: 'none',
                           boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                           padding: '10px',
                         }}
                         formatter={(value: number) => [`${value}건`, '방문 수']}
                         labelFormatter={(label) => `날짜: ${label}`}
                       />
                       <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                     </LineChart>
                   </ResponsiveContainer>
                 )}
               </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
               <h3 className="font-bold text-lg text-gray-800 mb-4">요일·시간대별 방문 히트맵</h3>
               {heatmapData.rows.length === 0 || heatmapData.max === 0 ? (
                 <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
                   방문 데이터가 충분하지 않습니다.
                 </div>
               ) : (
                 <div className="space-y-2">
                   <div className="flex items-center justify-between text-[10px] text-gray-400">
                     <span>왼쪽: 월요일 · 오른쪽: 일요일</span>
                     <span>색이 진할수록 해당 시간대 방문이 많습니다.</span>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="border-collapse text-[10px] text-gray-500">
                       <thead>
                         <tr>
                           <th className="p-1 text-left align-bottom">요일</th>
                           {Array.from({ length: 24 }).map((_, hour) => (
                             <th key={hour} className="p-0.5 text-center align-bottom">
                               {hour % 3 === 0 ? `${hour.toString().padStart(2, '0')}시` : ''}
                             </th>
                           ))}
                         </tr>
                       </thead>
                       <tbody>
                         {heatmapData.rows.map((row) => (
                           <tr key={row.dayIndex}>
                             <td className="pr-1 py-0.5 text-xs text-gray-500">{row.label}</td>
                             {row.values.map((value, hour) => {
                               const ratio =
                                 heatmapData.max > 0 ? value / heatmapData.max : 0;
                               const intensity = ratio === 0 ? 0 : 0.15 + 0.75 * ratio;
                               const bg =
                                 ratio === 0
                                   ? '#f9fafb'
                                   : `rgba(37, 99, 235, ${intensity.toFixed(2)})`;
                               const textColor = ratio > 0.6 ? '#f9fafb' : '#111827';
                               return (
                                 <td key={hour} className="p-0.5">
                                   <div
                                     className="w-4 h-4 rounded-sm text-[9px] flex items-center justify-center"
                                     style={{ backgroundColor: bg, color: textColor }}
                                     title={`${row.label}요일 ${hour}시: ${value}건`}
                                   >
                                     {value > 0 ? value : ''}
                                   </div>
                                 </td>
                               );
                             })}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
               <h3 className="font-bold text-lg text-gray-800 mb-4">운영 요약</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                   <span className="text-sm text-gray-600">좌석 점유율</span>
                   <div className="flex items-center gap-2">
                       <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                           <div className="h-full bg-brand-500 rounded-full" style={{ width: `${occupancyPercent}%` }}></div>
                       </div>
                       <span className="font-bold text-gray-900 text-sm">{occupancyPercent}%</span>
                   </div>
                 </div>
                 
                 <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">System Status</h4>
                    <p className="text-sm text-blue-600 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 정상 운영 중
                    </p>
                 </div>
                 {spaces.length > 0 && (
                   <div className="pt-3 border-t border-dashed border-gray-100">
                     <div className="flex items-center justify-between mb-2">
                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                         공간별 현재 이용 현황
                       </h4>
                       <span className="text-[10px] text-gray-400">
                         정원 값을 조정해 좌석 수를 변경할 수 있습니다.
                       </span>
                     </div>
                     <div className="space-y-2">
                       {spaces.map((space) => {
                         const percent =
                           space.capacity > 0
                             ? Math.min(
                                 100,
                                 Math.round(
                                   (space.currentOccupancy / space.capacity) *
                                     100,
                                 ),
                               )
                             : 0;
                         const isUpdating = updatingSpaceId === space.id;
                         return (
                           <div
                             key={space.id}
                             className="flex items-center justify-between gap-2"
                           >
                             <span className="text-xs text-gray-600 w-24 truncate">
                               {space.name}
                             </span>
                             <div className="flex items-center gap-2 flex-1">
                               <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                 <div
                                   className="h-full bg-brand-500 rounded-full"
                                   style={{ width: `${percent}%` }}
                                 ></div>
                               </div>
                               <div className="flex items-center gap-1">
                                 <input
                                   type="number"
                                   min={0}
                                   defaultValue={space.capacity}
                                   onBlur={(e) => {
                                     const val = parseInt(e.target.value, 10);
                                     if (!Number.isNaN(val) && val >= 0 && val !== space.capacity) {
                                       handleUpdateSpaceCapacity(space.id, val);
                                     }
                                   }}
                                   className="w-12 text-[11px] px-1 py-0.5 border border-gray-200 rounded-md text-right"
                                 />
                                 <span className="text-[11px] text-gray-500">
                                   석
                                 </span>
                               </div>
                               <span className="text-[11px] text-gray-500 w-16 text-right">
                                 {space.currentOccupancy}/{space.capacity}
                               </span>
                               {isUpdating && (
                                 <span className="text-[10px] text-gray-400">
                                   저장 중...
                                 </span>
                               )}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}
               </div>
            </div>

            {/* Member Summary / Management (Basic) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <Users className="text-brand-600" size={18} /> 회원 관리 (요약)
                </h3>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                  <Search size={14} className="text-gray-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="이름 또는 전화번호"
                    className="bg-transparent text-xs outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-auto -mx-3">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-400 uppercase">
                    <tr>
                      <th className="px-3 py-2 font-semibold">이름</th>
                      <th className="px-3 py-2 font-semibold">전화번호</th>
                      <th className="px-3 py-2 font-semibold">창업 여부</th>
                      <th className="px-3 py-2 font-semibold">제재 상태</th>
                      <th className="px-3 py-2 font-semibold">등록일</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-gray-400 text-xs"
                        >
                          등록된 회원이 없거나 검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.slice(0, 50).map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-2 font-semibold">
                            {m.name}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {m.phone_number}
                          </td>
                          <td className="px-3 py-2">
                            {m.is_startup === true && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                창업
                              </span>
                            )}
                            {m.is_startup === false && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                일반
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const visitorPenalties = penalties.filter(
                                (p) => p.visitor_id === m.id,
                              );
                              const warningCount = visitorPenalties.filter(
                                (p) => p.type === 'warning',
                              ).length;
                              const hasSuspension = visitorPenalties.some(
                                (p) => p.type === 'suspension' && p.active,
                              );

                              if (hasSuspension) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
                                      이용 정지
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleLiftSuspension(m.id)}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    >
                                      해제
                                    </button>
                                  </div>
                                );
                              }
                              if (warningCount > 0) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                      경고 {warningCount}회
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleSuspendVisitor(m.id)}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      이용 정지
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleAddWarning(m.id)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  경고 추가
                                </button>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-gray-400 font-mono">
                            {new Date(m.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                상세 회원 정보/제재 관리 화면은 추후 확장 가능합니다.
              </p>
            </div>

            {/* Program / Event Summary (Basic) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <Calendar className="text-brand-600" size={18} /> 프로그램 / 이벤트
                </h3>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  placeholder="오늘 진행할 프로그램 이름"
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={handleCreateProgram}
                  disabled={!newProgramName.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  등록
                </button>
              </div>
              <div className="max-h-56 overflow-auto -mx-3">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-400 uppercase">
                    <tr>
                      <th className="px-3 py-2 font-semibold">프로그램명</th>
                      <th className="px-3 py-2 font-semibold">일시</th>
                      <th className="px-3 py-2 font-semibold text-right pr-4">참여자 수</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {programs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-6 text-center text-gray-400 text-xs"
                        >
                          등록된 프로그램이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      programs.map((prog) => {
                        const visitCount = allVisits.filter(
                          (v) => v.program_id === prog.id,
                        ).length;
                        const start = new Date(prog.start_at);
                        const end = new Date(prog.end_at);
                        return (
                          <tr key={prog.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-semibold">
                              {prog.name}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-gray-500">
                              {start.toLocaleDateString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                              })}{' '}
                              {start.toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' ~ '}
                              {end.toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2 text-right pr-4">
                              <span className="inline-flex items-center justify-end gap-1 text-[11px] text-gray-700">
                                <Users size={10} /> {visitCount}명
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                키오스크에서 행사 참여 시 프로그램을 선택하도록 연동하면 출석 관리가 가능합니다.
              </p>
            </div>
          </div>

        </div>
      </div>

      {editingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">
              방문 기록 수정
            </h2>
            <p className="text-xs text-gray-500 mb-4 text-center">
              {editingVisit.visitor_name}님의 방문 목적, 공간, 입·퇴실 시간을 수정할 수 있습니다.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  방문 목적
                </label>
                <select
                  value={editingVisitPurpose}
                  onChange={(e) =>
                    setEditingVisitPurpose(e.target.value as Visit['purpose'])
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  {(Object.keys(PURPOSE_LABEL_MAP) as Visit['purpose'][]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {PURPOSE_LABEL_MAP[key]}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  이용 공간 (선택)
                </label>
                <select
                  value={editingVisitSpaceId}
                  onChange={(e) => setEditingVisitSpaceId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  <option value="">(지정 안 함)</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  입실 시각
                </label>
                <input
                  type="datetime-local"
                  value={editingVisitCheckIn}
                  onChange={(e) => setEditingVisitCheckIn(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  퇴실 시각 (선택)
                </label>
                <input
                  type="datetime-local"
                  value={editingVisitCheckOut}
                  onChange={(e) => setEditingVisitCheckOut(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  비워두면 퇴실 기록이 없는 상태로 유지됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelVisitEdit}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveVisitEdit}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 active:scale-95 transition-all"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
