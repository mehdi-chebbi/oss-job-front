export type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'comite_ajout' | 'comite_ouverture';
};

export type Department = {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string;
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  department_id: number;
  created_by: number;
  created_at: string;
  department_name?: string;
  created_by_name?: string;
};

export type Offer = {
  id: number;
  type: 'candidature' | 'manifestation' | 'appel_d_offre_service' | 'appel_d_offre_equipement' | 'consultation';
  title: string;
  description: string;
  country: string;
  project_id: number;
  project_name?: string;
  department_name?: string;
  reference: string;
  deadline: string;
  created_at: string;
  tdr_filename: string | null;
  tdr_url: string | null;
  notification_emails?: string | string[];
};

export type Application = {
  id: number;
  offer_id: number;
  full_name: string;
  email: string;
  tel_number: string;
  applicant_country: string;
  created_at: string;
  cv_url: string;
  cv_filename: string;
  diplome_url: string;
  diplome_filename: string;
  id_card_url: string;
  id_card_filename: string;
  cover_letter_url: string;
  cover_letter_filename: string;
  declaration_sur_honneur_url: string | null;
  declaration_sur_honneur_filename: string | null;
  fiche_de_referencement_url: string | null;
  fiche_de_referencement_filename: string | null;
  extrait_registre_url: string | null;
  extrait_registre_filename: string | null;
  note_methodologique_url: string | null;
  note_methodologique_filename: string | null;
  liste_references_url: string | null;
  liste_references_filename: string | null;
  offre_financiere_url: string | null;
  offre_financiere_filename: string | null;
  offer_title: string;
  offer_type: string;
  offer_department: string;
  offer_project?: string;
};

export type Log = {
  id: number;
  message: string;
  created_at: string;
};