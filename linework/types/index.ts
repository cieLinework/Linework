export interface User {
  id: string
  name: string
  initials: string
  color: string
  email?: string
  is_admin: boolean
  created_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  start_date?: string
  end_date?: string
  created_at: string
}

export interface Status {
  id: string
  name: string
  color: string
  is_done: boolean
  is_default: boolean
  sort_order: number
}

export interface Priority {
  id: string
  name: string
  color: string
  is_default: boolean
  sort_order: number
}

export interface Task {
  id: string
  title: string
  description?: string
  project_id?: string
  assignee_id?: string
  status: string
  priority?: string
  progress: number
  due_date?: string
  start_date?: string
  file_ref?: string
  attachment_name?: string
  attachment_size?: number
  attachment_type?: string
  created_by?: string
  created_at: string
  updated_at: string
  // Joined
  project?: Project
  assignee?: User
  blocked_by?: Task[]
  comments?: Comment[]
  drawing_stages?: DrawingStage[]
}

export interface Comment {
  id: string
  task_id: string
  author_id?: string
  author_name: string
  text: string
  created_at: string
  author?: User
}

export interface DrawingStage {
  id: string
  task_id: string
  stage_key: string
  collapsed: boolean
  sort_order: number
  items: DrawingItem[]
}

export interface DrawingItem {
  id: string
  drawing_stage_id: string
  name: string
  progress: number
  sort_order: number
}

export interface SessionUser {
  sub: string
  name: string
  initials: string
  color: string
  isAdmin: boolean
}

export const DRAWING_STAGE_TEMPLATES = [
  {
    key: 'site', icon: '🌍', label: 'Site Drawings',
    items: ['Location Plan','Site Plan','Traffic Management Plan','Site Management Plan','Solid Waste Management Plan']
  },
  {
    key: 'architectural', icon: '🏛️', label: 'Architectural',
    items: ['Ground Floor Dimension and Furniture Plan','First Floor Dimension and Furniture Plan','Roof Plan','Elevations','Sections','Door and Window Schedule','Ceiling Plans','Kitchen and Bathroom Elevations','Architectural Details']
  },
  {
    key: 'structural', icon: '🏗️', label: 'Structural',
    items: ['Foundation Plan and Details','Column Details','Stair Plan and Details','First Floor Reinforcement Layout and Sections','First Floor Beam Sections and Details','Roof Beam Sections and Details','Roof Plan and Details','Structural Details']
  },
  {
    key: 'electrical', icon: '⚡', label: 'Electrical',
    items: ['Ground Floor Small Power Layout','First Floor Small Power Layout','Ground Floor Lighting Layout','First Floor Lighting Layout']
  },
  {
    key: 'plumbing', icon: '🔧', label: 'Plumbing',
    items: ['Plumbing Isometrics','Ground Floor Plumbing Layout','First Floor Plumbing Layout']
  }
]
