export interface ProfileRecord {
  id: string;
  is_superadmin: boolean | null;
  is_matrix_admin: boolean | null;
}

export interface HumorFlavorRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  llm_system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface HumorFlavorStepRecord {
  id: string;
  humor_flavor_id: string;
  title: string;
  llm_user_prompt: string;
  order_by: number;
  image_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImageRecord {
  id: string;
  title: string | null;
  bucket_id: string | null;
  object_path: string | null;
  storage_path: string | null;
  public_url: string | null;
}

export interface FlavorWithSteps extends HumorFlavorRecord {
  steps: Array<HumorFlavorStepRecord & { image: ImageRecord | null }>;
}
