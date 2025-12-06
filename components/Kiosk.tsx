import React, { useState, useEffect, useRef } from 'react';
import NumberPad from './NumberPad';
import {
  findVisitorByPhone,
  createVisitor,
  checkIn,
  getLastActiveVisit,
  checkOut,
  getSpacesWithOccupancy,
  getActivePenaltyForVisitor,
  getPrograms,
  updateVisit,
} from '../services/dataService';
import { Visit, Program } from '../types';
import {
  Loader2,
  UserPlus,
  LogOut,
  CheckCircle2,
  Trophy,
  BookOpen,
  Users,
  Coffee,
  Calendar,
  HelpCircle,
  ArrowRight,
  Smartphone,
} from 'lucide-react';

type Step =
  | 'PHONE'
  | 'NAME'
  | 'EXTRA'
  | 'TERMS'
  | 'PURPOSE'
  | 'PROGRAM'
  | 'SPACE'
  | 'PROCESSING'
  | 'SUCCESS_IN'
  | 'SUCCESS_OUT'
  | 'ACTIVE_CHOICE';

// Map internal English keys to Korean display values and Icons
const PURPOSE_MAP: Record<Visit['purpose'], { label: string; icon: React.ReactNode; desc: string }> = {
  'Study': { label: '개인 학습', icon: <BookOpen className="text-blue-500" />, desc: '집중해서 공부해요' },
  'Meeting': { label: '회의 / 미팅', icon: <Users className="text-purple-500" />, desc: '함께 논의해요' },
  'Rest': { label: '휴식', icon: <Coffee className="text-orange-500" />, desc: '잠시 쉬어가요' },
  'Event': { label: '행사 참여', icon: <Calendar className="text-pink-500" />, desc: '프로그램에 참여해요' },
  'Other': { label: '기타', icon: <HelpCircle className="text-gray-500" />, desc: '다른 용무가 있어요' },
};

const PURPOSES = Object.keys(PURPOSE_MAP) as Visit['purpose'][];

const formatPhone = (val: string) => {
  // 8자리 입력 기준: 12345678 -> 1234-5678
  if (val.length <= 4) return val;
  return `${val.slice(0, 4)}-${val.slice(4)}`;
};

const Kiosk: React.FC = () => {
  const [step, setStep] = useState<Step>('PHONE');
  const [lang, setLang] = useState<'ko' | 'en'>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('centerflow_lang') : null;
    return stored === 'en' ? 'en' : 'ko';
  });
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [isStartup, setIsStartup] = useState<boolean | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<Visit['purpose'] | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [visitSummary, setVisitSummary] = useState<{ name: string; duration?: string; hours?: number; mins?: number }>({ name: '' });
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<{ id: string; name: string; capacity: number; currentOccupancy: number }[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [isChangingSpace, setIsChangingSpace] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	  // Auto-reset timer
	  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (step === 'SUCCESS_IN' || step === 'SUCCESS_OUT') {
      timer = setTimeout(() => resetKiosk(), 5000);
    }
    return () => clearTimeout(timer);
	  }, [step]);

  // Persist language preference
  useEffect(() => {
    try {
      window.localStorage.setItem('centerflow_lang', lang);
    } catch {
      // ignore
    }
  }, [lang]);

  // Global idle timer: reset to initial screen after period of inactivity
  useEffect(() => {
    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      // Don't run idle timeout on initial screen
      if (step === 'PHONE') return;
      idleTimerRef.current = setTimeout(() => {
        resetKiosk();
      }, 60000); // 60 seconds of inactivity
    };

    const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));

    // Start timer for current step
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach((event) =>
        window.removeEventListener(event, resetIdleTimer),
      );
    };
  }, [step]);

  const resetKiosk = () => {
    setStep('PHONE');
    setPhone('');
    setName('');
    setBirthDate('');
    setAddress('');
    setIsStartup(null);
    setVisitorId(null);
    setSelectedPurpose(null);
    setSelectedProgramId(null);
    setVisitSummary({ name: '' });
    setError(null);
    setSpaces([]);
    setLoadingSpaces(false);
    setPrograms([]);
    setLoadingPrograms(false);
    setTermsAccepted(false);
    setActiveVisit(null);
    setIsChangingSpace(false);
  };

  const handlePhoneSubmit = async () => {
    // 휴대폰 번호 뒷자리 8자리 기준
    if (phone.length < 8) return;
    setStep('PROCESSING');
    try {
      const existingVisitor = await findVisitorByPhone(phone);
      
      if (existingVisitor) {
        // Check for active suspension
        const activePenalty = await getActivePenaltyForVisitor(
          existingVisitor.id,
        );
        if (activePenalty) {
          setVisitSummary({ name: existingVisitor.name });
          setError(
            '이용이 일시적으로 제한된 회원입니다.\n자세한 내용은 안내 데스크에 문의해주세요.',
          );
          setStep('PHONE');
          return;
        }

        setVisitorId(existingVisitor.id);
        setVisitSummary({ name: existingVisitor.name });
        
        // Check if currently checked in
        const existingActiveVisit = await getLastActiveVisit(existingVisitor.id);
        if (existingActiveVisit) {
          // Existing active visit: let user choose between room change and checkout
          setActiveVisit(existingActiveVisit);
          setIsChangingSpace(false);
          setStep('ACTIVE_CHOICE');
        } else {
          // Returning user check-in
          setStep('PURPOSE');
        }
      } else {
        // New User
        setStep('NAME');
      }
    } catch (e) {
      setError(
        lang === 'en'
          ? 'A network error occurred. Please try again.'
          : '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
      );
      setStep('PHONE');
    }
  };

  const handleNameSubmit = async () => {
    if (!name.trim()) return;
    // Move to extra info step; actual registration happens after extra info + terms
    setStep('EXTRA');
  };

  const handleExtraSubmit = async () => {
    // After collecting extra info, move to terms agreement
    setStep('TERMS');
  };

  const handleTermsSubmit = async () => {
    if (!termsAccepted) return;
    setStep('PROCESSING');
    try {
      const newVisitor = await createVisitor({
        phone,
        name,
        birth_date: birthDate || undefined,
        address: address || undefined,
        is_startup: isStartup === null ? undefined : isStartup,
        terms_accepted_at: new Date().toISOString(),
      });
      setVisitorId(newVisitor.id);
      setVisitSummary({ name: newVisitor.name });
      setStep('PURPOSE');
    } catch (e) {
      setError(
        lang === 'en'
          ? 'Registration failed. Please try again.'
          : '등록에 실패했습니다. 다시 시도해주세요.',
      );
      setStep('TERMS');
    }
  };

  const handlePurposeSelect = async (purpose: Visit['purpose']) => {
    if (!visitorId) return;
    setSelectedPurpose(purpose);

    // If event/program participation, ask for program first
    if (purpose === 'Event') {
      setStep('PROGRAM');
      setLoadingPrograms(true);
      try {
        const result = await getPrograms();
        setPrograms(result);
        setLoadingPrograms(false);
      } catch (e) {
        setError(
          lang === 'en'
            ? 'Failed to load programs.'
            : '프로그램 목록을 불러오는 데 실패했습니다.',
        );
        setLoadingPrograms(false);
        setStep('PHONE');
      }
      return;
    }

    // Otherwise go directly to space selection
    setStep('SPACE');
    setLoadingSpaces(true);
    try {
      const result = await getSpacesWithOccupancy();
      setSpaces(result);
      setLoadingSpaces(false);
    } catch (e) {
      setError(
        lang === 'en'
          ? 'Failed to load space information.'
          : '공간 정보를 불러오는 데 실패했습니다.',
      );
      setLoadingSpaces(false);
      setStep('PHONE');
    }
  };

  const handleProgramSelect = async (programId: string) => {
    if (!visitorId || selectedPurpose !== 'Event') return;
    setSelectedProgramId(programId);
    setStep('SPACE');
    setLoadingSpaces(true);
    try {
      const result = await getSpacesWithOccupancy();
      setSpaces(result);
      setLoadingSpaces(false);
    } catch (e) {
      setError(
        lang === 'en'
          ? 'Failed to load space information.'
          : '공간 정보를 불러오는 데 실패했습니다.',
      );
      setLoadingSpaces(false);
      setStep('PHONE');
    }
  };

  const handleSpaceSelect = async (spaceId: string) => {
    if (!visitorId) return;

    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return;
    if (space.currentOccupancy >= space.capacity) {
      setError(
        lang === 'en'
          ? 'This space is already full. Please choose another space.'
          : '이미 정원이 가득 찬 공간입니다. 다른 공간을 선택해주세요.',
      );
      return;
    }

    setStep('PROCESSING');
    try {
      if (isChangingSpace && activeVisit) {
        const updated = await updateVisit(activeVisit.id, {
          space_id: spaceId,
          space_name: space.name,
        });
        setActiveVisit(updated);
        setIsChangingSpace(false);
        setStep('SUCCESS_IN');
      } else {
        if (!selectedPurpose) return;
        const visitor = { id: visitorId, name: visitSummary.name, phone_number: phone, created_at: '' };
        await checkIn(visitor, selectedPurpose, spaceId, selectedProgramId || undefined);
        setStep('SUCCESS_IN');
      }
    } catch (e) {
      setError(
        lang === 'en'
          ? 'Check-in failed.'
          : '체크인에 실패했습니다.',
      );
      setStep('PHONE');
    }
  };

  const handleCheckOut = async (visit: Visit) => {
    try {
      const updatedVisit = await checkOut(visit.id);
      
      // Calculate duration
      const start = new Date(updatedVisit.check_in_at).getTime();
      const end = new Date(updatedVisit.check_out_at!).getTime();
      const diffMins = Math.round((end - start) / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      
      let durationStr = '';
      if (hours > 0) durationStr += `${hours}시간 `;
      durationStr += `${mins}분`;

      setVisitSummary(prev => ({ ...prev, duration: durationStr, hours, mins }));
      setStep('SUCCESS_OUT');
      setActiveVisit(null);
      setIsChangingSpace(false);
    } catch (e) {
      setError(
        lang === 'en'
          ? 'Check-out failed.'
          : '체크아웃에 실패했습니다.',
      );
      setStep('PHONE');
    }
  };

  // --- Renders ---

  if (step === 'PROCESSING') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-3xl shadow-xl flex flex-col items-center">
            <Loader2 className="animate-spin text-brand-600 mb-4" size={48} />
            <p className="text-lg text-gray-600 font-medium">
              {lang === 'en' ? 'Processing...' : '처리 중입니다...'}
            </p>
        </div>
      </div>
    );
  }

  if (step === 'SUCCESS_IN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6 animate-fade-in">
        <div className="bg-white p-12 rounded-[2rem] shadow-2xl text-center max-w-md w-full border border-green-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="bg-green-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-[bounce_1s_infinite]">
            <CheckCircle2 className="text-green-500" size={64} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {lang === 'en'
              ? activeVisit
                ? `Your space has been updated, ${visitSummary.name}.`
                : `Welcome, ${visitSummary.name}!`
              : activeVisit
                ? `${visitSummary.name}님의 이용 공간이 변경되었습니다.`
                : `${visitSummary.name}님, 환영합니다!`}
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            {lang === 'en'
              ? activeVisit
                ? 'You can continue using the space.'
                : 'Check-in has been completed.'
              : activeVisit
                ? '계속 이용하실 수 있습니다.'
                : '입실 처리가 완료되었습니다.'}
          </p>
          <div className="text-sm text-gray-400">
            {lang === 'en' ? 'Have a great time! ✨' : '좋은 시간 보내세요! ✨'}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'SUCCESS_OUT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6 animate-fade-in">
        <div className="bg-white p-12 rounded-[2rem] shadow-2xl text-center max-w-md w-full border border-indigo-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 to-purple-500"></div>
          
          <div className="mb-6 relative inline-block">
             <Trophy className="text-yellow-400 drop-shadow-md mx-auto" size={80} strokeWidth={1.5} />
             <div className="absolute -top-2 -right-2 text-2xl">🔥</div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {lang === 'en'
              ? `Well done, ${visitSummary.name}!`
              : `수고하셨습니다, ${visitSummary.name}님!`}
          </h2>
          <p className="text-gray-500 mb-6">
            {lang === 'en' ? 'Your focus time today' : '오늘의 집중 시간'}
          </p>
          
          <div className="bg-gray-900 text-white rounded-2xl py-6 px-4 mb-8 shadow-xl transform transition-transform hover:scale-105 duration-300">
            <span className="text-4xl font-mono font-bold tracking-tight">
                {visitSummary.hours ? <span className="text-brand-300">{visitSummary.hours}</span> : ''}
                {visitSummary.hours ? <span className="text-2xl font-normal text-gray-400 mx-1">h</span> : ''}
                <span className="text-brand-300">{visitSummary.mins}</span>
                <span className="text-2xl font-normal text-gray-400 ml-1">m</span>
            </span>
          </div>
          
          <button onClick={resetKiosk} className="text-gray-400 hover:text-gray-600 text-sm font-medium underline decoration-gray-300 underline-offset-4">
            {lang === 'en' ? 'Back to start' : '처음으로 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'NAME') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
            {lang === 'en' ? 'Please enter your name' : '성함을 입력해주세요'}
          </h2>
          <p className="text-center text-gray-500 mb-8 text-sm">
            {lang === 'en'
              ? 'Welcome! Tell us your name to register.'
              : '처음 오셨군요! 등록을 위해 이름을 알려주세요.'}
          </p>
          
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-center text-3xl font-bold p-6 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 outline-none transition-all mb-8 placeholder:text-gray-300"
            placeholder={lang === 'en' ? 'Enter your name' : '이름 입력'}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
          />
          
          <div className="space-y-3">
              <button
                onClick={handleNameSubmit}
                disabled={!name.trim()}
                className="w-full bg-brand-600 text-white text-xl font-bold py-5 rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {lang === 'en' ? 'Register and start' : '등록하고 시작하기'} <ArrowRight size={24} />
              </button>
              <button onClick={() => setStep('PHONE')} className="w-full py-4 text-gray-400 hover:text-gray-600 font-medium transition-colors">
                {lang === 'en' ? 'Back' : '뒤로 가기'}
              </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'EXTRA') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
            {lang === 'en' ? 'Please add a few details' : '추가 정보를 입력해주세요'}
          </h2>
          <p className="text-center text-gray-500 mb-8 text-sm">
            {lang === 'en'
              ? 'We only ask for minimal information to improve service and statistics.'
              : '통계와 운영을 위해 최소 정보만 요청드립니다.'}
          </p>

          <div className="space-y-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                {lang === 'en' ? 'Date of birth (optional)' : '생년월일 (선택)'}
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full text-center text-lg p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                {lang === 'en'
                  ? 'Residence / main activity area (optional)'
                  : '거주지/주 활동 지역 (선택)'}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-sm p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 outline-none transition-all"
                placeholder={
                  lang === 'en' ? 'e.g. Gangdong-gu, Seoul...' : '예: 서울시 강동구 ...'
                }
              />
              <p className="mt-1 text-[11px] text-gray-400">
                {lang === 'en'
                  ? 'Later this will be connected to an address search API for more accurate input.'
                  : '추후 주소 검색 API와 연동하여 보다 정확한 주소를 입력할 수 있도록 개선될 예정입니다.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                {lang === 'en' ? 'Are you a startup team?' : '창업/창업 준비 여부'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsStartup(true)}
                  className={`p-4 rounded-2xl border text-sm font-semibold transition-all ${
                    isStartup === true
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {lang === 'en' ? 'Yes, startup / preparing' : '네, 창업(준비) 중이에요'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsStartup(false)}
                  className={`p-4 rounded-2xl border text-sm font-semibold transition-all ${
                    isStartup === false
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {lang === 'en' ? 'No, not a startup' : '아니요, 일반 이용자예요'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                {lang === 'en'
                  ? 'This information is only used for startup-related statistics and service planning.'
                  : '이 정보는 창업 관련 통계 및 프로그램 기획을 위해서만 활용됩니다.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleExtraSubmit}
              className="w-full bg-brand-600 text-white text-xl font-bold py-5 rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {lang === 'en' ? 'Continue' : '계속 진행하기'} <ArrowRight size={24} />
            </button>
            <button
              onClick={() => setStep('NAME')}
              className="w-full py-4 text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              {lang === 'en' ? 'Back' : '뒤로 가기'}
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-400 text-center">
            {lang === 'en'
              ? 'You can skip this and still use the space; information is used only for statistics and service improvement.'
              : '입력하지 않아도 이용은 가능하며, 통계와 서비스 품질 개선에만 활용됩니다.'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'TERMS') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
            {lang === 'en' ? 'Agree to Terms of Use' : '이용 약관 동의'}
          </h2>
          <p className="text-center text-gray-500 mb-6 text-sm">
            {lang === 'en'
              ? 'Please read and agree to the terms to use the space.'
              : '센터 공간 이용을 위해 약관을 확인 후 동의해주세요.'}
          </p>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4 h-40 overflow-auto text-xs text-gray-600 leading-relaxed">
            {lang === 'en' ? (
              <>
                <p className="mb-2 font-semibold text-gray-800">
                  [Required] Summary of Space Use Terms
                </p>
                <p className="mb-1">
                  · This space is provided for youth learning, startup activities, and community events.
                </p>
                <p className="mb-1">
                  · Violation of operating rules (noise, drinking, damage, etc.) may result in restricted use.
                </p>
                <p className="mb-1">
                  · Personal information is used only for visit records and statistical analysis and is stored securely under relevant laws.
                </p>
                <p className="mb-1">
                  · For full details, please refer to the on-site notice or ask the staff.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 font-semibold text-gray-800">[필수] 공간 이용 약관 요약</p>
                <p className="mb-1">
                  · 본 공간은 청년의 학습, 창업, 커뮤니티 활동을 위한 공유 공간입니다.
                </p>
                <p className="mb-1">
                  · 소란 행위, 음주, 시설 파손 등 운영 규정을 위반할 경우 이용이 제한될 수 있습니다.
                </p>
                <p className="mb-1">
                  · 개인정보는 방문 기록 관리 및 통계 분석 목적으로만 사용되며, 관련 법령에 따라 안전하게 보관됩니다.
                </p>
                <p className="mb-1">
                  · 자세한 내용은 관리자 또는 센터 안내문을 통해 확인하실 수 있습니다.
                </p>
              </>
            )}
          </div>

          <label className="flex items-start gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700">
              {lang === 'en' ? (
                <>
                  I have read and understood the above and{' '}
                  <span className="font-semibold text-gray-900">
                    agree to the Terms of Use.
                  </span>
                </>
              ) : (
                <>
                  위 내용을 모두 읽고 이해했으며,{' '}
                  <span className="font-semibold text-gray-900">
                    [공간 이용 약관]에 동의합니다.
                  </span>
                </>
              )}
            </span>
          </label>

          <div className="space-y-3">
            <button
              onClick={handleTermsSubmit}
              disabled={!termsAccepted}
              className="w-full bg-brand-600 text-white text-xl font-bold py-5 rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {lang === 'en' ? 'Agree and continue' : '동의하고 계속 진행하기'}{' '}
              <ArrowRight size={24} />
            </button>
            <button
              onClick={() => setStep('EXTRA')}
              className="w-full py-4 text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              {lang === 'en' ? 'Back to previous step' : '이전 단계로 돌아가기'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'PURPOSE') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {lang === 'en'
                ? `Hello, ${visitSummary.name}! 👋`
                : `${visitSummary.name}님, 안녕하세요! 👋`}
            </h2>
            <p className="text-gray-500">
              {lang === 'en'
                ? 'Please select the purpose of your visit today.'
                : '오늘의 방문 목적을 선택해주세요.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {PURPOSES.map((p) => (
              <button
                key={p}
                onClick={() => handlePurposeSelect(p)}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 hover:bg-brand-50 transition-all active:scale-98 text-left flex items-center gap-4 group relative overflow-hidden"
              >
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                    {PURPOSE_MAP[p].icon}
                </div>
                <div>
                    <div className="font-bold text-lg text-gray-800 group-hover:text-brand-700">{PURPOSE_MAP[p].label}</div>
                    <div className="text-xs text-gray-400 group-hover:text-brand-400">{PURPOSE_MAP[p].desc}</div>
                </div>
                <div className="absolute right-5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 text-brand-400">
                    <ArrowRight />
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep('PHONE')} className="mt-8 text-gray-400 hover:text-gray-600 w-full text-center py-4">
            {lang === 'en' ? 'Cancel and go back' : '취소하고 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'SPACE') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {lang === 'en'
                ? 'Please select the space you will use'
                : '이용하실 공간을 선택해주세요'}
            </h2>
            <p className="text-gray-500 text-sm">
              {lang === 'en'
                ? 'You can see current occupancy and capacity before choosing.'
                : '현재 인원과 정원을 확인하고 선택할 수 있습니다.'}
            </p>
          </div>

          {loadingSpaces ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
              <Loader2 className="mx-auto mb-3 text-brand-500 animate-spin" />
              <p className="text-sm text-gray-500">
                {lang === 'en'
                  ? 'Loading space information...'
                  : '공간 정보를 불러오는 중입니다...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 mb-4">
              {spaces.map((space) => {
                const percent =
                  space.capacity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (space.currentOccupancy / space.capacity) * 100,
                        ),
                      )
                    : 0;
                const isFull = space.currentOccupancy >= space.capacity;
                return (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => !isFull && handleSpaceSelect(space.id)}
                    className={`w-full text-left p-5 rounded-2xl border shadow-sm transition-all ${
                      isFull
                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-100 hover:border-brand-200 hover:shadow-md hover:bg-brand-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg text-gray-900">
                        {space.name}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                          isFull
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : percent >= 80
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        {space.currentOccupancy} / {space.capacity}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isFull
                            ? 'bg-red-400'
                            : percent >= 80
                            ? 'bg-amber-400'
                            : 'bg-brand-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    {isFull && (
                      <p className="mt-2 text-xs text-red-500">
                        {lang === 'en'
                          ? 'This space is full.'
                          : '정원이 가득 찼습니다.'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-center mb-4 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              setError(null);
              setStep('PURPOSE');
            }}
            className="w-full py-4 text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            {lang === 'en'
              ? 'Back to purpose selection'
              : '목적 선택으로 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'PROGRAM') {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {lang === 'en'
                ? 'Select the program you are attending'
                : '참여하실 프로그램을 선택해주세요'}
            </h2>
            <p className="text-gray-500 text-sm">
              {lang === 'en'
                ? 'Your check-in will be linked to this event.'
                : '입실 기록이 선택한 프로그램 출석으로 연결됩니다.'}
            </p>
          </div>

          {loadingPrograms ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
              <Loader2 className="mx-auto mb-3 text-brand-500 animate-spin" />
              <p className="text-sm text-gray-500">
                {lang === 'en'
                  ? 'Loading programs...'
                  : '프로그램 정보를 불러오는 중입니다...'}
              </p>
            </div>
          ) : programs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm text-sm text-gray-500">
              {lang === 'en'
                ? 'There are no registered programs at the moment. Please contact the staff.'
                : '현재 등록된 프로그램이 없습니다. 안내 데스크에 문의해주세요.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 mb-4">
              {programs.map((prog) => {
                const start = new Date(prog.start_at);
                const end = new Date(prog.end_at);
                return (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => handleProgramSelect(prog.id)}
                    className="w-full text-left p-5 rounded-2xl border shadow-sm transition-all bg-white border-gray-100 hover:border-brand-200 hover:shadow-md hover:bg-brand-50/40"
                  >
                    <div className="font-bold text-base text-gray-900 mb-1">
                      {prog.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {start.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' ~ '}
                      {end.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              setError(null);
              setSelectedProgramId(null);
              setStep('PURPOSE');
            }}
            className="w-full py-4 text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            {lang === 'en'
              ? 'Back to purpose selection'
              : '목적 선택으로 돌아가기'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'ACTIVE_CHOICE' && activeVisit) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-50 px-4 py-12 animate-slide-up">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
            {lang === 'en'
              ? `${visitSummary.name}, what would you like to do?`
              : `${visitSummary.name}님, 어떻게 하실까요?`}
          </h2>
          <p className="text-center text-gray-500 mb-6 text-sm whitespace-pre-line">
            {lang === 'en'
              ? `You are currently checked in.\nYou can move to another space or check out.`
              : `현재 이용 중이세요.\n다른 공간으로 옮기거나, 퇴실을 선택할 수 있습니다.`}
          </p>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6 text-sm text-gray-600">
            <div className="font-semibold mb-1">
              {lang === 'en' ? 'Current usage info' : '현재 이용 정보'}
            </div>
            <div className="text-xs text-gray-500">
              {lang === 'en' ? 'Space' : '이용 공간'}:{' '}
              <span className="font-semibold text-gray-800">
                {activeVisit.space_name || (lang === 'en' ? 'Unassigned' : '지정 없음')}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setIsChangingSpace(true);
                setStep('SPACE');
                setLoadingSpaces(true);
                try {
                  const result = await getSpacesWithOccupancy();
                  setSpaces(result);
                } catch (e) {
                  setError(
                    lang === 'en'
                      ? 'Failed to load space information.'
                      : '공간 정보를 불러오는 데 실패했습니다.',
                  );
                  setStep('PHONE');
                } finally {
                  setLoadingSpaces(false);
                }
              }}
              className="w-full bg-brand-600 text-white text-lg font-bold py-4 rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {lang === 'en' ? 'Move to another space' : '다른 공간으로 이동'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeVisit) {
                  handleCheckOut(activeVisit);
                }
              }}
              className="w-full bg-gray-900 text-white text-lg font-bold py-4 rounded-2xl shadow-lg shadow-gray-300 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              {lang === 'en' ? 'Check out' : '퇴실하기'}
            </button>

            <button
              type="button"
              onClick={resetKiosk}
              className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
            >
              {lang === 'en' ? 'Cancel and go back' : '취소하고 처음으로'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: PHONE Input
  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-brand-50/50 to-white pt-10 px-4">
      <div className="w-full max-w-md flex flex-col items-center">
        
        {/* Brand Header + Language toggle */}
        <div className="w-full flex items-center justify-between mb-8">
          <div className="text-left">
            <div className="bg-brand-600 w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-brand-500/30">
              <Smartphone className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              CenterFlow
            </h1>
            <p className="text-brand-600 font-medium text-sm mt-1">
              {lang === 'en'
                ? 'Smart entry & exit management'
                : '스마트 입출입 관리 시스템'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white/70 border border-gray-200 rounded-full px-1 py-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setLang('ko')}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                lang === 'ko'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              한글
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                lang === 'en'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Input Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 w-full mb-6">
          <div className="text-center mb-8">
            <label className="block text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">
              {lang === 'en' ? 'Enter last 8 digits of mobile' : '휴대폰 번호 뒷자리 8자리 입력'}
            </label>
            <div
              className={`
                    text-4xl font-mono font-semibold tracking-wider h-14 flex items-center justify-center rounded-xl bg-gray-50 border-2 
                    ${phone ? 'text-gray-900 border-brand-200 bg-brand-50/30' : 'text-gray-300 border-transparent'}
                    transition-all duration-300
                `}
            >
              {phone
                ? formatPhone(phone)
                : '0000-0000'}
            </div>
          </div>
          
          <NumberPad
            value={phone}
            onInput={(key) => setPhone(prev => prev + key)}
            onDelete={() => setPhone(prev => prev.slice(0, -1))}
            onSubmit={handlePhoneSubmit}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-center mb-4 text-sm font-medium animate-pulse w-full shadow-sm">
            {error}
          </div>
        )}

        <div className="text-center text-gray-400 text-xs font-medium">
          {lang === 'en'
            ? 'Enter the last 8 digits to check in, move rooms, or check out.'
            : '휴대폰 번호 뒷자리 8자리로 입실, 방 이동, 퇴실을 선택할 수 있습니다.'}
        </div>
      </div>
    </div>
  );
};

export default Kiosk;
