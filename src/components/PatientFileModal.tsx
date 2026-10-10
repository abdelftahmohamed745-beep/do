import React from 'react';
import { PatientFileSidePanel } from './PatientFileSidePanel';
import { PatientRecord } from '../types';

interface PatientFileModalProps {
  doctorId: string;
  patientPhone: string;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  patientRecord?: PatientRecord | null;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PatientFileModal: React.FC<PatientFileModalProps> = (props) => {
  return <PatientFileSidePanel {...props} />;
};
