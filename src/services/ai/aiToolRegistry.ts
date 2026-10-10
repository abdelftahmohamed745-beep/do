import { FunctionDeclaration, Type } from "@google/genai";
import { AiToolDefinition, AiToolName } from "../../types/aiAgent";

export const AI_TOOL_DEFINITIONS: Record<AiToolName, AiToolDefinition> = {
  // ==========================================
  // READ TOOLS
  // ==========================================
  search_patients: {
    name: 'search_patients',
    category: 'READ',
    requiredPermission: 'VIEW_PATIENTS',
    descriptionAr: 'البحث عن ملفات المرضى المسجلين بالعيادة بالاسم أو رقم الهاتف أو المعرف',
    descriptionEn: 'Search for clinic patient records by patient name, phone number, or patient ID',
    parameters: {
      searchTerm: {
        name: 'searchTerm',
        type: 'string',
        description: 'اسم المريض أو جزء من اسمه أو رقم هاتفه',
        required: true
      },
      limit: {
        name: 'limit',
        type: 'number',
        description: 'أقصى عدد للنتائج (افتراضياً 8)',
        required: false
      }
    }
  },

  get_patient_details: {
    name: 'get_patient_details',
    category: 'READ',
    requiredPermission: 'VIEW_PATIENTS',
    descriptionAr: 'عرض تفاصيل الملف الطبي الكامل للمريض وتاريخ الزيارات والروشتات والمستحقات المالية',
    descriptionEn: 'Get full patient medical file details including past visits, prescriptions, and financial balance',
    parameters: {
      patientIdOrPhone: {
        name: 'patientIdOrPhone',
        type: 'string',
        description: 'رقم هاتف المريض أو معرف المريض (PID)',
        required: true
      }
    }
  },

  get_daily_queue: {
    name: 'get_daily_queue',
    category: 'READ',
    requiredPermission: 'MANAGE_QUEUE',
    descriptionAr: 'استعراض طابور المرضى لليوم الحالي وحالاتهم (في الانتظار، تم النداء، انتهى، إلخ) ومعرفة المريض الحالي',
    descriptionEn: 'Get the active patient queue for today including waiting, called, and done counts',
    parameters: {
      date: {
        name: 'date',
        type: 'string',
        description: 'تاريخ اليوم بصيغة YYYY-MM-DD (افتراضياً اليوم الحالي)',
        required: false
      },
      statusFilter: {
        name: 'statusFilter',
        type: 'string',
        description: 'تصفية حسب الحالة: waiting | called | done | cancelled | all',
        required: false,
        enum: ['waiting', 'called', 'done', 'cancelled', 'all']
      }
    }
  },

  get_follow_up_appointments: {
    name: 'get_follow_up_appointments',
    category: 'READ',
    requiredPermission: 'VIEW_APPOINTMENTS',
    descriptionAr: 'استعراض مواعيد إعادة الكشف والاستشارات القادمة للمرضى في تاريخ محدد أو لفترة قادمة',
    descriptionEn: 'Get scheduled follow-up and revisit appointments for patients',
    parameters: {
      date: {
        name: 'date',
        type: 'string',
        description: 'تاريخ محدد بصيغة YYYY-MM-DD أو فارغ لجميع المواعيد القادمة',
        required: false
      }
    }
  },

  get_financial_summary: {
    name: 'get_financial_summary',
    category: 'READ',
    requiredPermission: 'VIEW_FINANCE',
    descriptionAr: 'عرض ملخص الإيرادات والمقبوضات والمبالغ المتبقية للعيادة لليوم أو لفترة محددة',
    descriptionEn: 'Get clinic financial summary, revenue, collected amounts, and outstanding balance',
    parameters: {
      date: {
        name: 'date',
        type: 'string',
        description: 'تاريخ اليوم المراد حسابه بصيغة YYYY-MM-DD (افتراضياً اليوم)',
        required: false
      }
    }
  },

  get_active_tasks: {
    name: 'get_active_tasks',
    category: 'READ',
    requiredPermission: 'VIEW_CLINIC',
    descriptionAr: 'استعراض القواعد والمهام الذاتية الآلية المجدولة والنشطة في العيادة',
    descriptionEn: 'Get active autonomous rules, triggers, and scheduled tasks in the clinic',
    parameters: {}
  },

  get_audit_logs: {
    name: 'get_audit_logs',
    category: 'READ',
    requiredPermission: 'VIEW_REPORTS',
    descriptionAr: 'استعراض سجل العمليات والتدقيق الأمني لإجراءات الذكاء الاصطناعي وفريق العمل',
    descriptionEn: 'Get system audit trail and AI agent execution logs',
    parameters: {
      limit: {
        name: 'limit',
        type: 'number',
        description: 'عدد السجلات المطلوبة (افتراضياً 20)',
        required: false
      }
    }
  },

  // ==========================================
  // SAFE WRITE TOOLS
  // ==========================================
  register_patient_ticket: {
    name: 'register_patient_ticket',
    category: 'WRITE',
    requiredPermission: 'CREATE_PATIENT',
    descriptionAr: 'حجز تذكرة كشف جديدة لمريض في طابور اليوم بالاسم ورقم الهاتف ونوع الخدمة',
    descriptionEn: 'Book a new queue ticket for a patient in today\'s queue',
    parameters: {
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'اسم المريض الثلاثي أو الثنائي',
        required: true
      },
      patientPhone: {
        name: 'patientPhone',
        type: 'string',
        description: 'رقم هاتف المريض المصري (11 رقم يبدأ بـ 01)',
        required: true
      },
      serviceName: {
        name: 'serviceName',
        type: 'string',
        description: 'اسم الخدمة (كشف جديد، استشارة، كشف مستعجل، متابعة)',
        required: false
      },
      price: {
        name: 'price',
        type: 'number',
        description: 'سعر الكشف بالجنيه المصري',
        required: false
      }
    }
  },

  call_next_patient: {
    name: 'call_next_patient',
    category: 'WRITE',
    requiredPermission: 'MANAGE_QUEUE',
    descriptionAr: 'النداء التلقائي على المريض التالي في طابور الانتظار وتحديث حالته إلى دخل العيادة (called)',
    descriptionEn: 'Call the next waiting patient in the queue and transition their status to called',
    parameters: {}
  },

  update_patient_status: {
    name: 'update_patient_status',
    category: 'WRITE',
    requiredPermission: 'MANAGE_QUEUE',
    descriptionAr: 'تحديث حالة مريض محدد في الطابور (called: داخل العيادة، done: انتهى الكشف، cancelled: ملغي، waiting: في الانتظار)',
    descriptionEn: 'Update status of a specific patient ticket in the queue',
    parameters: {
      patientRecordId: {
        name: 'patientRecordId',
        type: 'string',
        description: 'اسم المريض أو رقم هاتفه أو معرف تذكرته في طابور اليوم',
        required: true
      },
      newStatus: {
        name: 'newStatus',
        type: 'string',
        description: 'الحالة الجديدة (waiting, called, done, cancelled)',
        required: true,
        enum: ['waiting', 'called', 'done', 'cancelled']
      }
    }
  },

  schedule_follow_up: {
    name: 'schedule_follow_up',
    category: 'WRITE',
    requiredPermission: 'CREATE_APPOINTMENT',
    descriptionAr: 'حجز وتحديد موعد إعادة كشف أو استشارة لمريض بتاريخ ووقت محددين',
    descriptionEn: 'Schedule a follow-up or revisit appointment for a patient',
    parameters: {
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'اسم المريض',
        required: true
      },
      patientPhone: {
        name: 'patientPhone',
        type: 'string',
        description: 'رقم هاتف المريض (اختياري، إذا لم يتوفر سيتم استخراجه تلقائياً من الطابور)',
        required: false
      },
      appointmentDate: {
        name: 'appointmentDate',
        type: 'string',
        description: 'تاريخ الموعد بصيغة YYYY-MM-DD',
        required: true
      },
      appointmentTime: {
        name: 'appointmentTime',
        type: 'string',
        description: 'وقت الموعد بصيغة HH:mm (مثال: 18:30)',
        required: true
      },
      reason: {
        name: 'reason',
        type: 'string',
        description: 'سبب إعادة الكشف أو الاستشارة',
        required: false
      },
      notes: {
        name: 'notes',
        type: 'string',
        description: 'ملاحظات إضافية للموعد',
        required: false
      }
    }
  },

  record_patient_payment: {
    name: 'record_patient_payment',
    category: 'WRITE',
    requiredPermission: 'MANAGE_FINANCE',
    descriptionAr: 'تسجيل معاملة سداد مالي لكشف مريض مع دعم الدفع المقسم (كاش / فيزا / تحويل بنكي)',
    descriptionEn: 'Record a clinic financial transaction / payment for a patient',
    parameters: {
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'اسم المريض',
        required: true
      },
      patientPhone: {
        name: 'patientPhone',
        type: 'string',
        description: 'رقم هاتف المريض (اختياري، إذا لم يذكره الطبيب سيتم استخراجه تلقائياً من طابور اليوم)',
        required: false
      },
      totalAmount: {
        name: 'totalAmount',
        type: 'number',
        description: 'إجمالي المبلغ المطلوب بالجنيه المصري',
        required: true
      },
      paidAmount: {
        name: 'paidAmount',
        type: 'number',
        description: 'المبلغ المدفوع بالفعل',
        required: true
      },
      paymentMethod: {
        name: 'paymentMethod',
        type: 'string',
        description: 'طريقة الدفع (CASH, CARD, VODAFONE_CASH, INSTAPAY, BANK_TRANSFER)',
        required: true,
        enum: ['CASH', 'CARD', 'VODAFONE_CASH', 'INSTAPAY', 'BANK_TRANSFER']
      },
      serviceName: {
        name: 'serviceName',
        type: 'string',
        description: 'اسم الخدمة الطبية',
        required: false
      },
      notes: {
        name: 'notes',
        type: 'string',
        description: 'ملاحظات السداد',
        required: false
      }
    }
  },

  create_medical_order: {
    name: 'create_medical_order',
    category: 'WRITE',
    requiredPermission: 'MANAGE_QUEUE',
    descriptionAr: 'تسجيل طلب فحص طبي (أشعة أو تحاليل مخبرية) لمريض في الطابور',
    descriptionEn: 'Create a medical investigation order (lab or x-ray) for a patient in queue',
    parameters: {
      patientRecordId: {
        name: 'patientRecordId',
        type: 'string',
        description: 'معرف تذكرة المريض في طابور اليوم',
        required: true
      },
      orderType: {
        name: 'orderType',
        type: 'string',
        description: 'نوع الفحص: xray (أشعة) أو lab (تحاليل) أو xray_and_lab (أشعة وتحليل)',
        required: true,
        enum: ['xray', 'lab', 'xray_and_lab']
      },
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'اسم المريض',
        required: true
      },
      patientPhone: {
        name: 'patientPhone',
        type: 'string',
        description: 'رقم هاتف المريض',
        required: false
      }
    }
  },

  create_autonomous_task: {
    name: 'create_autonomous_task',
    category: 'WRITE',
    requiredPermission: 'MANAGE_SETTINGS',
    descriptionAr: 'إنشاء وحفظ قاعدة آلية ذكية أو مهمة ذاتية للعيادة تُنفذ عند حدوث حدث معين أو شرط نظام',
    descriptionEn: 'Create and save an autonomous AI rule or trigger in the clinic',
    parameters: {
      title: {
        name: 'title',
        type: 'string',
        description: 'عنوان المهمة الآلية (مثال: تنبيه عند تجاوز وقت الانتظار 45 دقيقة)',
        required: true
      },
      description: {
        name: 'description',
        type: 'string',
        description: 'وصف المهمة وما ستقوم به بالتفصيل',
        required: true
      },
      triggerType: {
        name: 'triggerType',
        type: 'string',
        description: 'نوع المشغل: EVENT أو CONDITION أو SCHEDULE',
        required: true,
        enum: ['EVENT', 'CONDITION', 'SCHEDULE']
      },
      event: {
        name: 'event',
        type: 'string',
        description: 'الحدث المسبب: PATIENT_REGISTERED, PATIENT_CALLED, PATIENT_DONE, PAYMENT_RECORDED, SESSION_COMPLETED',
        required: false,
        enum: ['PATIENT_REGISTERED', 'PATIENT_CALLED', 'PATIENT_DONE', 'PAYMENT_RECORDED', 'SESSION_COMPLETED']
      },
      condition: {
        name: 'condition',
        type: 'string',
        description: 'الشرط: QUEUE_WAIT_TIME_EXCEEDED, OUTSTANDING_BALANCE_EXCEEDED, DAILY_CAPACITY_REACHED',
        required: false,
        enum: ['QUEUE_WAIT_TIME_EXCEEDED', 'OUTSTANDING_BALANCE_EXCEEDED', 'DAILY_CAPACITY_REACHED']
      },
      threshold: {
        name: 'threshold',
        type: 'number',
        description: 'القيمة الحدية للشرط (مثال: 30 دقيقة أو 500 جنيه)',
        required: false
      },
      actionType: {
        name: 'actionType',
        type: 'string',
        description: 'الإجراء التلقائي: ALERT_STAFF, SEND_REMINDER, FLAG_HIGH_BALANCE, AUTO_CALL_NEXT, GENERATE_SESSION_REPORT',
        required: true,
        enum: ['ALERT_STAFF', 'SEND_REMINDER', 'FLAG_HIGH_BALANCE', 'AUTO_CALL_NEXT', 'GENERATE_SESSION_REPORT']
      },
      messageTemplate: {
        name: 'messageTemplate',
        type: 'string',
        description: 'نص الرسالة أو التنبيه عند التنفيذ',
        required: false
      }
    }
  },

  toggle_autonomous_task: {
    name: 'toggle_autonomous_task',
    category: 'WRITE',
    requiredPermission: 'MANAGE_SETTINGS',
    descriptionAr: 'تفعيل أو إيقاف مؤقت لمهمة آلية ذاتية في العيادة',
    descriptionEn: 'Toggle an autonomous task status between active and paused',
    parameters: {
      taskId: {
        name: 'taskId',
        type: 'string',
        description: 'معرف المهمة الآلية',
        required: true
      },
      status: {
        name: 'status',
        type: 'string',
        description: 'الحالة الجديدة: active أو paused',
        required: true,
        enum: ['active', 'paused']
      }
    }
  },

  update_patient_profile: {
    name: 'update_patient_profile',
    category: 'WRITE',
    requiredPermission: 'CREATE_PATIENT',
    descriptionAr: 'تعديل وتحديث بيانات المريض والملف الطبي (الاسم، الهاتف، فصيلة الدم، الحساسيات الدوائية، الأمراض المزمنة، والملاحظات السريرية)',
    descriptionEn: 'Update patient profile and clinical file details (name, phone, blood group, allergies, chronic diseases, notes)',
    parameters: {
      patientPhoneOrName: {
        name: 'patientPhoneOrName',
        type: 'string',
        description: 'رقم هاتف المريض أو اسمه لتحديد ملفه الطبي',
        required: true
      },
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'الاسم الجديد للمريض إذا كان التعديل للاسم',
        required: false
      },
      newPhone: {
        name: 'newPhone',
        type: 'string',
        description: 'رقم الهاتف الجديد إذا كان التعديل لرقم الهاتف',
        required: false
      },
      allergies: {
        name: 'allergies',
        type: 'string',
        description: 'الحساسيات الدوائية والغذائية للمريض (مثل: حساسية بنسلين)',
        required: false
      },
      chronicDiseases: {
        name: 'chronicDiseases',
        type: 'string',
        description: 'الأمراض المزمنة (مثل: ضغط، سكري، ربو)',
        required: false
      },
      bloodGroup: {
        name: 'bloodGroup',
        type: 'string',
        description: 'فصيلة الدم (A+, B+, O+, AB+, إلخ)',
        required: false
      },
      generalNotes: {
        name: 'generalNotes',
        type: 'string',
        description: 'ملاحظات طبية أو سريرية عامة حول المريض',
        required: false
      }
    }
  },

  add_patient_consultation_note: {
    name: 'add_patient_consultation_note',
    category: 'WRITE',
    requiredPermission: 'CREATE_PATIENT',
    descriptionAr: 'تسجيل وتوثيق زيارة كشف طبي للمريض مع التشخيص، الشكوى، وخطة العلاج أو الروشتة في ملفه الطبي الدائم',
    descriptionEn: 'Add clinical consultation entry with diagnosis, complaints, and prescription to patient medical file',
    parameters: {
      patientPhoneOrName: {
        name: 'patientPhoneOrName',
        type: 'string',
        description: 'اسم المريض أو رقم هاتفه',
        required: true
      },
      diagnosis: {
        name: 'diagnosis',
        type: 'string',
        description: 'التشخيص الطبي للحالة',
        required: true
      },
      prescription: {
        name: 'prescription',
        type: 'string',
        description: 'العلاج أو الأدوية الموصوفة والجرعات',
        required: false
      },
      notes: {
        name: 'notes',
        type: 'string',
        description: 'ملاحظات الفحص الإكلينيكي أو توصيات المتابعة',
        required: false
      },
      serviceName: {
        name: 'serviceName',
        type: 'string',
        description: 'نوع الخدمة (كشف جديد، إعادة كشف، استشارة)',
        required: false
      }
    }
  },

  cancel_queue_ticket: {
    name: 'cancel_queue_ticket',
    category: 'WRITE',
    requiredPermission: 'MANAGE_QUEUE',
    descriptionAr: 'إلغاء حجز أو دور مريض في طابور اليوم باسمه أو رقم هاتفه أو معرف تذكرته',
    descriptionEn: 'Cancel a patient queue ticket for today by name, phone, or ticket ID',
    parameters: {
      patientIdentifier: {
        name: 'patientIdentifier',
        type: 'string',
        description: 'اسم المريض أو رقم هاتفه أو معرف تذكرته في طابور اليوم',
        required: true
      },
      reason: {
        name: 'reason',
        type: 'string',
        description: 'سبب إلغاء الحجز',
        required: false
      }
    }
  },

  // ==========================================
  // SENSITIVE TOOLS (REQUIRE 2-STEP CONFIRMATION)
  // ==========================================
  cancel_appointment: {
    name: 'cancel_appointment',
    category: 'SENSITIVE',
    requiredPermission: 'EDIT_APPOINTMENT',
    requiresConfirmation: true,
    descriptionAr: 'إلغاء موعد كشف أو إعادة كشف لمريض بعد التأكيد الصريح',
    descriptionEn: 'Cancel a scheduled patient appointment (requires explicit confirmation)',
    parameters: {
      appointmentId: {
        name: 'appointmentId',
        type: 'string',
        description: 'معرف الموعد المراد إلغاؤه',
        required: true
      },
      reason: {
        name: 'reason',
        type: 'string',
        description: 'سبب الإلغاء',
        required: true
      }
    }
  },

  mark_patient_no_show: {
    name: 'mark_patient_no_show',
    category: 'SENSITIVE',
    requiredPermission: 'MANAGE_QUEUE',
    requiresConfirmation: true,
    descriptionAr: 'تسجيل تخلف مريض عن الحضور (No-Show) في طابور اليوم مع الحفاظ على ملفه وسجلاته',
    descriptionEn: 'Mark patient as No-Show in the queue (requires confirmation)',
    parameters: {
      patientRecordId: {
        name: 'patientRecordId',
        type: 'string',
        description: 'معرف تذكرة المريض في طابور اليوم',
        required: true
      },
      patientName: {
        name: 'patientName',
        type: 'string',
        description: 'اسم المريض للتأكيد',
        required: true
      }
    }
  },

  refund_payment: {
    name: 'refund_payment',
    category: 'SENSITIVE',
    requiredPermission: 'REFUND_PAYMENT',
    requiresConfirmation: true,
    descriptionAr: 'استرداد مالي لمبلغ كشف تم دفعه سابقاً (يتطلب صلاحية استرداد الأموال وتأكيداً ثنائياً)',
    descriptionEn: 'Refund a previously paid transaction amount (requires REFUND_PAYMENT permission and explicit confirmation)',
    parameters: {
      transactionId: {
        name: 'transactionId',
        type: 'string',
        description: 'معرف المعاملة المالية',
        required: true
      },
      refundAmount: {
        name: 'refundAmount',
        type: 'number',
        description: 'المبلغ المسترد بالجنيه المصري',
        required: true
      },
      reason: {
        name: 'reason',
        type: 'string',
        description: 'سبب استرداد المبلغ',
        required: true
      }
    }
  }
};

/**
 * Generate @google/genai FunctionDeclaration array for tool registration
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(AI_TOOL_DEFINITIONS).map((def) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    Object.entries(def.parameters).forEach(([paramKey, paramSchema]) => {
      let typeEnum = Type.STRING;
      if (paramSchema.type === 'number') typeEnum = Type.NUMBER;
      else if (paramSchema.type === 'boolean') typeEnum = Type.BOOLEAN;
      else if (paramSchema.type === 'object') typeEnum = Type.OBJECT;
      else if (paramSchema.type === 'array') typeEnum = Type.ARRAY;

      properties[paramKey] = {
        type: typeEnum,
        description: paramSchema.description
      };

      if (paramSchema.enum) {
        properties[paramKey].enum = paramSchema.enum;
      }

      if (paramSchema.required) {
        required.push(paramKey);
      }
    });

    return {
      name: def.name,
      description: `${def.descriptionAr} - ${def.descriptionEn}`,
      parameters: {
        type: Type.OBJECT,
        properties,
        required: required.length > 0 ? required : undefined
      }
    };
  });
}
