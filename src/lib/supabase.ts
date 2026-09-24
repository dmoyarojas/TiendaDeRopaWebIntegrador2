import { createClient } from '@supabase/supabase-js'

// TODO: Reemplaza estas URLs y Claves con las de tu proyecto real de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kyliylilzpxiswxntcoj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bGl5bGlsenB4aXN3eG50Y29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODE2NDAsImV4cCI6MjEwMjU1NzY0MH0.phVTDoq0TOB_ogwSGs7ivxje3muaCHPMKFsLZPJhyUc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
