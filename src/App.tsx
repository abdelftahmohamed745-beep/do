/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import {
  getDoctorProfile,
  purgeTestAccounts,
  verifyAdminStatus,
  subscribeAnnouncementsForUser,
  fetchUserReadAnnouncements,
  saveUserReadAnnouncements
} from './services/firebaseService';
import { DoctorProfile, ToastMessage, AdminAnnouncement } from './types';

// Components
import { Navbar, NavTabType } from './components/Navbar';
import { DoctorsDirectory } from './components/DoctorsDirectory';
import { ClinicProfilePage } from './components/ClinicProfilePage';
import { DoctorDashboard } from './components/DoctorDashboard';
import { SubscriptionGate } from './components/SubscriptionGate';
import { PatientBooking } from './components/PatientBooking';
import { PatientTicket } from './components/PatientTicket';
import { SubscriptionPage } from './components/SubscriptionPage';
import { AuthPage } from './components/AuthPage';
import { AdminGuard } from './components/AdminGuard';
import { QRModal } from './components/QRModal';
import { QRScannerModal } from './components/QRScannerModal';
import { SettingsModal } from './components/SettingsModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { ClinicInvitationAcceptModal } from './components/ClinicInvitationAcceptModal';
import { ToastContainer } from './components/Toast';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { setPageSeo, DEFAULT_HOMEPAGE_SEO } from './utils/seo';

// Dedicated SEO & Content Pages
import { AboutPage } from './components/pages/AboutPage';
import { ForClinicsPage } from './components/pages/ForClinicsPage';
import { ForPatientsPage } from './components/pages/ForPatientsPage';
import { FaqPage } from './components/pages/FaqPage';
import { PrivacyPage } from './components/pages/PrivacyPage';

interface NavState {
  tab: NavTabType;
  selectedDoctorId: string;
  viewClinicDoctorId: string;
  selectedPatientId: string | null;
}

export default function App() {
  const [currentDoctor, setCurrentDoctor] = useState<DoctorProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTabType>('dashboard');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [viewClinicDoctorId, setViewClinicDoctorId] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Navigation History Stack
  const [navHistory, setNavHistory] = useState<NavState[]>([]);

  // Central Navigation Handler
  const navigateTo = (
    newTab: NavTabType,
    options?: {
      doctorId?: string;
      clinicDoctorId?: string;
      patientId?: string | null;
    }
  ) => {
    console.log('[DIAGNOSTIC] navigateTo invoked:', { newTab, options, currentTab: activeTab, currentDocId: selectedDoctorId });
    const currentState: NavState = {
      tab: activeTab,
      selectedDoctorId,
      viewClinicDoctorId,
      selectedPatientId
    };

    // Save current state to history stack if navigating to a different view or context
    if (
      currentState.tab !== newTab ||
      (options?.doctorId !== undefined && options.doctorId !== selectedDoctorId) ||
      (options?.clinicDoctorId !== undefined && options.clinicDoctorId !== viewClinicDoctorId) ||
      (options?.patientId !== undefined && options.patientId !== selectedPatientId)
    ) {
      setNavHistory((prev) => [...prev, currentState]);
    }

    const targetDoctorId = options?.doctorId !== undefined ? options.doctorId : selectedDoctorId;
    const targetClinicDoctorId = options?.clinicDoctorId !== undefined ? options.clinicDoctorId : viewClinicDoctorId;
    const targetPatientId = options?.patientId !== undefined ? options.patientId : selectedPatientId;

    if (options?.doctorId !== undefined) setSelectedDoctorId(options.doctorId);
    if (options?.clinicDoctorId !== undefined) setViewClinicDoctorId(options.clinicDoctorId);
    if (options?.patientId !== undefined) setSelectedPatientId(options.patientId);

    setActiveTab(newTab);

    // Sync clean URL bar in browser
    if (typeof window !== 'undefined') {
      if (newTab === 'clinic' && targetClinicDoctorId) {
        const cleanPath = `/clinic/${encodeURIComponent(targetClinicDoctorId)}`;
        if (window.location.pathname + window.location.search !== cleanPath) {
          window.history.pushState({ tab: 'clinic', doctorId: targetClinicDoctorId }, '', cleanPath);
        }
      } else if (newTab === 'booking' && targetDoctorId) {
        const cleanPath = `/clinic/${encodeURIComponent(targetDoctorId)}/book`;
        if (window.location.pathname + window.location.search !== cleanPath) {
          window.history.pushState({ tab: 'booking', doctorId: targetDoctorId }, '', cleanPath);
        }
      } else if (newTab === 'ticket' && targetDoctorId && targetPatientId) {
        const cleanPath = `/clinic/${encodeURIComponent(targetDoctorId)}?ticket=${encodeURIComponent(targetPatientId)}`;
        if (window.location.pathname + window.location.search !== cleanPath) {
          window.history.pushState({ tab: 'ticket', doctorId: targetDoctorId, patientId: targetPatientId }, '', cleanPath);
        }
      } else if (newTab === 'about') {
        if (window.location.pathname !== '/about') {
          window.history.pushState({ tab: 'about' }, '', '/about');
        }
      } else if (newTab === 'for-clinics') {
        if (window.location.pathname !== '/for-clinics') {
          window.history.pushState({ tab: 'for-clinics' }, '', '/for-clinics');
        }
      } else if (newTab === 'for-patients') {
        if (window.location.pathname !== '/for-patients') {
          window.history.pushState({ tab: 'for-patients' }, '', '/for-patients');
        }
      } else if (newTab === 'faq') {
        if (window.location.pathname !== '/faq') {
          window.history.pushState({ tab: 'faq' }, '', '/faq');
        }
      } else if (newTab === 'privacy') {
        if (window.location.pathname !== '/privacy') {
          window.history.pushState({ tab: 'privacy' }, '', '/privacy');
        }
      } else if (newTab === 'admin') {
        if (window.location.pathname !== '/admin') {
          window.history.pushState({ tab: 'admin' }, '', '/admin');
        }
      } else if (newTab === 'auth') {
        if (window.location.pathname !== '/auth') {
          window.history.pushState({ tab: 'auth' }, '', '/auth');
        }
      } else if (newTab === 'directory') {
        if (window.location.pathname !== '/directory') {
          window.history.pushState({ tab: 'directory' }, '', '/directory');
        }
      } else if (newTab === 'dashboard' && window.location.pathname !== '/') {
        window.history.pushState({ tab: 'dashboard' }, '', '/');
      }
    }
  };

  // Back Button Handler (Goes 1 step back in navigation history)
  const handleGoBack = () => {
    if (navHistory.length === 0) {
      // Fallback to browser history if available
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      }
      return;
    }

    const previousState = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, prev.length - 1));

    setActiveTab(previousState.tab);
    setSelectedDoctorId(previousState.selectedDoctorId);
    setViewClinicDoctorId(previousState.viewClinicDoctorId);
    setSelectedPatientId(previousState.selectedPatientId);

    if (typeof window !== 'undefined') {
      if (previousState.tab === 'clinic' && previousState.viewClinicDoctorId) {
        window.history.replaceState(null, '', `/clinic/${encodeURIComponent(previousState.viewClinicDoctorId)}`);
      } else if (previousState.tab === 'booking' && previousState.selectedDoctorId) {
        window.history.replaceState(null, '', `/clinic/${encodeURIComponent(previousState.selectedDoctorId)}/book`);
      } else if (previousState.tab === 'ticket' && previousState.selectedDoctorId && previousState.selectedPatientId) {
        window.history.replaceState(null, '', `/clinic/${encodeURIComponent(previousState.selectedDoctorId)}?ticket=${encodeURIComponent(previousState.selectedPatientId)}`);
      } else if (previousState.tab === 'about') {
        window.history.replaceState(null, '', '/about');
      } else if (previousState.tab === 'for-clinics') {
        window.history.replaceState(null, '', '/for-clinics');
      } else if (previousState.tab === 'for-patients') {
        window.history.replaceState(null, '', '/for-patients');
      } else if (previousState.tab === 'faq') {
        window.history.replaceState(null, '', '/faq');
      } else if (previousState.tab === 'privacy') {
        window.history.replaceState(null, '', '/privacy');
      } else if (previousState.tab === 'admin') {
        window.history.replaceState(null, '', '/admin');
      } else if (previousState.tab === 'auth') {
        window.history.replaceState(null, '', '/auth');
      } else if (previousState.tab === 'directory') {
        window.history.replaceState(null, '', '/directory');
      } else if (previousState.tab === 'dashboard') {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  // System Announcements State
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dawry_read_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Subscribe to real-time announcements broadcast
  useEffect(() => {
    const role = isPlatformAdmin
      ? 'admin'
      : currentDoctor
      ? 'doctor'
      : 'visitor';

    const unsubscribe = subscribeAnnouncementsForUser(
      role,
      currentDoctor?.uid || null,
      (liveAnnouncements) => {
        setAnnouncements(liveAnnouncements);
      }
    );

    return () => unsubscribe();
  }, [currentDoctor?.uid, isPlatformAdmin]);

  // Sync read states from cloud when user logs in
  useEffect(() => {
    if (!currentDoctor?.uid) return;
    let isMounted = true;
    fetchUserReadAnnouncements(currentDoctor.uid).then((remoteIds) => {
      if (!isMounted || !remoteIds || remoteIds.length === 0) return;
      setReadAnnouncementIds((prev) => {
        const merged = Array.from(new Set([...prev, ...remoteIds]));
        try {
          localStorage.setItem('dawry_read_announcements', JSON.stringify(merged));
        } catch {
          // Ignore local storage error
        }
        return merged;
      });
    });
    return () => {
      isMounted = false;
    };
  }, [currentDoctor?.uid]);

  const handleMarkAnnouncementRead = (id: string) => {
    setReadAnnouncementIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('dawry_read_announcements', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save read announcements to storage', err);
      }
      if (currentDoctor?.uid) {
        saveUserReadAnnouncements(currentDoctor.uid, updated);
      }
      return updated;
    });
  };

  const handleMarkAllAnnouncementsRead = () => {
    const allIds = announcements.map((a) => a.id);
    setReadAnnouncementIds(allIds);
    try {
      localStorage.setItem('dawry_read_announcements', JSON.stringify(allIds));
    } catch (err) {
      console.error('Failed to save read announcements to storage', err);
    }
    if (currentDoctor?.uid) {
      saveUserReadAnnouncements(currentDoctor.uid, allIds);
    }
  };

  const unreadAnnouncementsCount = announcements.filter(
    (a) => !readAnnouncementIds.includes(a.id)
  ).length;

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    title: string,
    message?: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Parse URL route or query params on load and navigation
  const parseUrlRoute = () => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    console.log('[DIAGNOSTIC] ROUTE_EVALUATION:', {
      CURRENT_ROUTE: pathname,
      BOOK_PARAMETER: params.get('book'),
      TICKET_PARAMETER: params.get('ticket')
    });

    // Check invitation token query param: ?invite=<token>
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setPendingInviteToken(inviteParam);
    }

    // Check clean route: /dashboard
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      setActiveTab('dashboard');
      return;
    }

    // Check clean route: /auth or /login
    if (pathname === '/auth' || pathname === '/auth/' || pathname === '/login' || pathname === '/login/') {
      setActiveTab('auth');
      return;
    }

    // Check clean route: /directory (Preserved legacy route)
    if (pathname === '/directory' || pathname === '/directory/') {
      setActiveTab('directory');
      return;
    }

    // Check clean route: /admin
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      setActiveTab('admin');
      return;
    }

    // Check clean route: /about
    if (pathname === '/about' || pathname === '/about/') {
      setActiveTab('about');
      return;
    }

    // Check clean route: /for-clinics
    if (pathname === '/for-clinics' || pathname === '/for-clinics/') {
      setActiveTab('for-clinics');
      return;
    }

    // Check clean route: /for-labs
    if (pathname === '/for-labs' || pathname === '/for-labs/') {
      setActiveTab('for-labs');
      return;
    }

    // Check clean route: /for-patients
    if (pathname === '/for-patients' || pathname === '/for-patients/') {
      setActiveTab('for-patients');
      return;
    }

    // Check clean route: /faq
    if (pathname === '/faq' || pathname === '/faq/') {
      setActiveTab('faq');
      return;
    }

    // Check clean route: /privacy
    if (pathname === '/privacy' || pathname === '/privacy/') {
      setActiveTab('privacy');
      return;
    }

    // Check clean route: /subscription
    if (pathname === '/subscription' || pathname === '/subscription/') {
      setActiveTab('subscription');
      return;
    }

    // Check clean route: /clinic/:docId or /clinic/:docId/book
    const clinicMatch = pathname.match(/^\/clinic\/([^/?#]+)(\/book)?/);
    if (clinicMatch && clinicMatch[1]) {
      const docId = decodeURIComponent(clinicMatch[1]);
      const isDirectBookRoute = Boolean(clinicMatch[2]) || pathname.endsWith('/book');
      setSelectedDoctorId(docId);
      setViewClinicDoctorId(docId);

      const isBook = isDirectBookRoute || params.get('book') === 'true' || params.get('book') === '1';
      const ticketParam = params.get('ticket');

      if (isBook) {
        console.log('[QR] DIRECT_BOOKING_ROUTE', { path: pathname });
        console.log('[QR] DOCTOR_ID', docId);
        console.log('[QR] BOOKING_PAGE_LOADED');
      }

      if (ticketParam) {
        setSelectedPatientId(ticketParam);
        setActiveTab('ticket');
      } else if (isBook) {
        setActiveTab('booking');
      } else {
        setActiveTab('clinic');
      }
      return;
    }

    // Check legacy query params: ?doc=<docId>
    const docParam = params.get('doc');
    const ticketParam = params.get('ticket');
    const viewParam = params.get('view');

    if (docParam) {
      setSelectedDoctorId(docParam);
      setViewClinicDoctorId(docParam);

      if (ticketParam) {
        setSelectedPatientId(ticketParam);
        setActiveTab('ticket');
      } else if (viewParam === 'clinic') {
        setActiveTab('clinic');
      } else {
        setActiveTab('booking');
      }
    } else {
      // Default landing for root: Clinic OS Dashboard (or Auth workspace if not logged in)
      if (pathname === '/' || pathname === '') {
        setActiveTab('dashboard');
      }
    }
  };

  useEffect(() => {
    parseUrlRoute();

    const handlePopState = () => {
      parseUrlRoute();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'directory') {
      setPageSeo(DEFAULT_HOMEPAGE_SEO);
    }
  }, [activeTab]);

  // Firebase Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Non-blocking background reload to keep token fresh without stalling initial render
        user.reload().catch(() => {});

        const adminRes = await verifyAdminStatus(user);
        setIsPlatformAdmin(adminRes.isAdmin);

        let isVerified = user.emailVerified;
        if (!isVerified) {
          try {
            const vSnap = await getDoc(doc(db, "email_verifications", user.uid));
            if (vSnap.exists() && vSnap.data()?.verified === true) {
              isVerified = true;
            }
          } catch (e) {
            console.warn("Could not check email_verifications status:", e);
          }
        }

        if (!isVerified) {
          setCurrentDoctor(null);
          return;
        }

        const docProfile = await getDoctorProfile(user.uid);
        if (docProfile) {
          setCurrentDoctor(docProfile);

          // If user didn't explicitly open patient, clinic, or admin link, navigate to dashboard
          const params = new URLSearchParams(window.location.search);
          const isClinicRoute = window.location.pathname.startsWith('/clinic/');
          const isAdminRoute = window.location.pathname.startsWith('/admin');
          if (!params.get('doc') && !isClinicRoute && !isAdminRoute) {
            setActiveTab('dashboard');
          }
        }
      } else {
        setCurrentDoctor(null);
        setIsPlatformAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentDoctor(null);
    setIsPlatformAdmin(false);
    setActiveTab('auth');
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'auth' }, '', '/auth');
    }
    addToast("تم تسجيل الخروج بنجاح", "", "info");
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-800 flex flex-col font-['Cairo',sans-serif]">
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Navbar */}
      <Navbar
        currentDoctor={currentDoctor}
        activeTab={activeTab}
        isAdmin={isPlatformAdmin}
        unreadNotificationCount={unreadAnnouncementsCount}
        onNavigate={(tab) => {
          if (tab === 'booking') {
            const docId = currentDoctor?.uid || selectedDoctorId;
            const lastTicket = docId ? localStorage.getItem(`dawry_ticket_${docId}`) : null;
            if (lastTicket && selectedPatientId) {
              navigateTo('ticket', { doctorId: docId });
            } else {
              navigateTo('booking', { doctorId: docId });
            }
          } else {
            navigateTo(tab);
          }
        }}
        onOpenQRModal={() => setIsQRModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationCenterOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-28 sm:pb-16">
        
        {/* Global Back Button (Shown when navigation history exists) */}
        {navHistory.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-1 flex items-center justify-start">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-sky-700 rounded-2xl text-xs font-extrabold border border-slate-200/90 shadow-2xs hover:shadow-xs transition active:scale-95 group cursor-pointer"
              title="الرجوع للصفحة السابقة (خطوة واحدة للخلف)"
            >
              <ArrowRight className="w-4 h-4 text-sky-600 group-hover:-translate-x-1 transition-transform" />
              <span>رجوع</span>
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {/* Doctors Directory Tab (Default Landing View for patients) */}
            {activeTab === 'directory' && (
              <DoctorsDirectory
                onSelectDoctorClinic={(docId) => {
                  navigateTo('clinic', { clinicDoctorId: docId });
                }}
                onBookTurn={(docId) => {
                  navigateTo('booking', { doctorId: docId });
                }}
                onNavigateAuth={() => {
                  navigateTo('auth');
                }}
                onNavigate={navigateTo}
                onShowToast={addToast}
              />
            )}

            {/* Dedicated Page: About Dory */}
            {activeTab === 'about' && (
              <AboutPage
                onNavigate={navigateTo}
                onNavigateAuth={() => {
                  navigateTo('auth');
                }}
              />
            )}

            {/* Dedicated Page: For Clinics */}
            {activeTab === 'for-clinics' && (
              <ForClinicsPage
                onNavigate={navigateTo}
                onNavigateAuth={() => {
                  navigateTo('auth');
                }}
              />
            )}

            {/* Dedicated Page: For Patients */}
            {activeTab === 'for-patients' && (
              <ForPatientsPage
                onNavigate={navigateTo}
              />
            )}

            {/* Dedicated Page: FAQ */}
            {activeTab === 'faq' && (
              <FaqPage
                onNavigate={navigateTo}
                onNavigateAuth={() => {
                  navigateTo('auth');
                }}
              />
            )}

            {/* Dedicated Page: Privacy & Security */}
            {activeTab === 'privacy' && (
              <PrivacyPage
                onNavigate={navigateTo}
              />
            )}

            {/* Single Clinic Public Profile Page */}
            {activeTab === 'clinic' && (
              <ClinicProfilePage
                doctorId={viewClinicDoctorId}
                onBookTurn={(docId) => {
                  navigateTo('booking', { doctorId: docId });
                }}
                onBackToDirectory={() => handleGoBack()}
                onShowToast={addToast}
              />
            )}

            {/* Doctor's Private Dashboard */}
            {activeTab === 'dashboard' && (
              currentDoctor ? (
                currentDoctor.isActive === false ? (
                  <div className="max-w-xl mx-auto px-4 py-16 text-center">
                    <div className="bg-amber-50 rounded-3xl p-8 border border-amber-200 shadow-xl">
                      <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <span className="font-black text-xl">!</span>
                      </div>
                      <h2 className="text-lg font-bold text-amber-900 mb-2">الحساب غير نشط حالياً</h2>
                      <p className="text-xs text-amber-800 leading-relaxed mb-6">
                        تم إيقاف حساب عيادتك مؤقتاً من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني لتفعيل الحساب.
                      </p>
                      <a
                        href="https://wa.me/201032120351"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition shadow-md"
                      >
                        <span>تواصل مع الدعم الفني (01032120351)</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <SubscriptionGate
                    doctor={currentDoctor}
                    onNavigateSubscription={() => navigateTo('subscription')}
                    onSignOut={handleSignOut}
                  >
                    <DoctorDashboard
                      doctor={currentDoctor}
                      onOpenQRModal={() => setIsQRModalOpen(true)}
                      onOpenScannerModal={() => setIsScannerModalOpen(true)}
                      onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
                      onNavigateSubscription={() => navigateTo('subscription')}
                      onShowToast={addToast}
                    />
                  </SubscriptionGate>
                )
              ) : (
                <AuthPage
                  onDoctorLoggedIn={(doc) => {
                    setCurrentDoctor(doc);
                    navigateTo('dashboard');
                  }}
                  onShowToast={addToast}
                  onSelectPatientBookingView={() => {
                    navigateTo('directory');
                  }}
                />
              )
            )}

            {/* Platform Protected Admin Guard & Dashboard */}
            {activeTab === 'admin' && (
              <AdminGuard
                onShowToast={addToast}
                onNavigateHome={() => navigateTo('directory')}
              />
            )}

            {/* Patient Live Booking View */}
            {activeTab === 'booking' && (
              <PatientBooking
                doctorId={selectedDoctorId}
                onBookingSuccess={(patientId) => {
                  navigateTo('ticket', { patientId });
                }}
                onShowToast={addToast}
                onBackToDoctorLogin={() => navigateTo('auth')}
              />
            )}

            {/* Patient Ticket & Live Queue Monitor View */}
            {activeTab === 'ticket' && selectedPatientId && (
              <PatientTicket
                doctorId={selectedDoctorId}
                patientId={selectedPatientId}
                onNewBooking={() => navigateTo('booking')}
                onShowToast={addToast}
              />
            )}

            {/* Subscription & Plans View */}
            {activeTab === 'subscription' && (
              <SubscriptionPage
                doctor={currentDoctor}
                onBackToDashboard={() => handleGoBack()}
                onShowToast={addToast}
              />
            )}

            {/* Doctor Login & Signup Auth View */}
            {activeTab === 'auth' && (
              <AuthPage
                onDoctorLoggedIn={(doc) => {
                  setCurrentDoctor(doc);
                  navigateTo('dashboard');
                }}
                onShowToast={addToast}
                onSelectPatientBookingView={() => {
                  navigateTo('directory');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Persistent Floating WhatsApp Button */}
      <FloatingWhatsApp />

      {/* Footer */}
      <footer className="bg-[#fdfcf9] border-t border-[#e7e3da] py-8 text-xs text-slate-500 mt-12 font-['Tajawal',sans-serif]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          {/* Main Footer Links */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#f0ebe1]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#122c4a] flex items-center justify-center text-white font-black text-xs">
                د
              </div>
              <span className="font-extrabold text-sm text-[#122c4a]">
                نظام تشغيل دوري (Dory) للعيادات الطبية
              </span>
            </div>

            <nav aria-label="روابط صفحات المنظومة" className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
              <button onClick={() => navigateTo('directory')} className="hover:text-[#122c4a] transition cursor-pointer">
                دليل العيادات
              </button>
              <span>•</span>
              <button onClick={() => navigateTo('about')} className="hover:text-[#122c4a] transition cursor-pointer">
                عن النظام
              </button>
              <span>•</span>
              <button onClick={() => navigateTo('for-clinics')} className="hover:text-[#1c5242] transition cursor-pointer">
                للأطباء والعيادات
              </button>
              <span>•</span>
              <button onClick={() => navigateTo('for-patients')} className="hover:text-[#b45309] transition cursor-pointer">
                للمرضى والمراجعين
              </button>
              <span>•</span>
              <button onClick={() => navigateTo('faq')} className="hover:text-[#122c4a] transition cursor-pointer">
                الأسئلة الشائعة
              </button>
              <span>•</span>
              <button onClick={() => navigateTo('privacy')} className="hover:text-[#122c4a] transition cursor-pointer">
                الخصوصية والأمان
              </button>
            </nav>
          </div>

          {/* Bottom Line */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-medium text-slate-600">
              دوري - نظام تشغيل وإدارة العيادات الطبية المستقلة © {new Date().getFullYear()}
            </div>
            
            <a
              href="https://wa.me/201032120351"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-full font-bold transition border border-emerald-200/80"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 fill-current" />
              <span>دعم وإدارة منصة دوري: 01032120351</span>
            </a>

            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
              <span>تحديث سحابي فوري (Real-time)</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Modals */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        announcements={announcements}
        readAnnouncementIds={readAnnouncementIds}
        onMarkAsRead={handleMarkAnnouncementRead}
        onMarkAllAsRead={handleMarkAllAnnouncementsRead}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        userId={currentDoctor?.uid || 'guest_user'}
        onShowToast={addToast}
      />

      {currentDoctor && (
        <>
          <QRModal
            isOpen={isQRModalOpen}
            onClose={() => setIsQRModalOpen(false)}
            doctor={currentDoctor}
            onCopyLink={() => addToast("تم نسخ رابط حجز العيادة بنجاح", "", "success")}
          />

          <QRScannerModal
            isOpen={isScannerModalOpen}
            onClose={() => setIsScannerModalOpen(false)}
            patients={[]}
            onSelectPatient={(p) => {
              addToast(`تم اختيار المريض #${p.sequenceNumber}`, p.name, "info");
            }}
          />

          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            doctor={currentDoctor}
            onShowToast={addToast}
          />
        </>
      )}

      {/* Clinic Invitation Acceptance Modal */}
      {pendingInviteToken && (
        <ClinicInvitationAcceptModal
          invitationToken={pendingInviteToken}
          currentUser={auth.currentUser}
          onAccepted={async () => {
            const urlWithoutInvite = new URL(window.location.href);
            urlWithoutInvite.searchParams.delete('invite');
            window.history.replaceState(null, '', urlWithoutInvite.pathname + urlWithoutInvite.search);
            setPendingInviteToken(null);

            if (auth.currentUser) {
              const docProfile = await getDoctorProfile(auth.currentUser.uid);
              if (docProfile) {
                setCurrentDoctor(docProfile);
              }
            }
            setActiveTab('dashboard');
          }}
          onClose={() => {
            const urlWithoutInvite = new URL(window.location.href);
            urlWithoutInvite.searchParams.delete('invite');
            window.history.replaceState(null, '', urlWithoutInvite.pathname + urlWithoutInvite.search);
            setPendingInviteToken(null);
          }}
          onShowToast={addToast}
        />
      )}

    </div>
  );
}
