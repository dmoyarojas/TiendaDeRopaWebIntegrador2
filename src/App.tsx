import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { supabase } from './lib/supabase'
import GarmentMeasurementEditor from './components/GarmentMeasurementEditor'
import { BODY_STORAGE_KEY } from './lib/fitting'

const FittingExperience = lazy(() => import('./components/FittingExperience'))

gsap.registerPlugin(ScrollTrigger)

// ─── Types ──────────────────────────────────────────────────────────────────

type Page = 'home' | 'products' | 'cart' | 'login' | 'register' | 'account' | 'avatar' | 'tryon' | 'checkout' | 'admin' | 'forgot-password'

interface Product {
  id: number | string
  name: string
  category: string
  price: number
  img: string
  stock?: number
  tag?: string
}

interface CartItem extends Product {
  qty: number
  size: string
}

interface UserMeasurements {
  gender: 'F' | 'M'
  height: string
  weight: string
  chest: string
  waist: string
  hips: string
  shoulder: string
  inseam: string
}

type UserRole = 'client' | 'admin'

interface StoredUser {
  name: string
  email: string
  password: string
  role: UserRole
  measurements: UserMeasurements
}

interface ReturnRow {
  id?: string
  code: string
  order: string
  client: string
  email?: string
  phone?: string
  address?: string
  product: string
  productImage?: string
  reason: string
  details?: string
  date: string
  status: string
  action: string
}

const DEFAULT_MEASUREMENTS: UserMeasurements = {
  gender: 'F',
  height: '',
  weight: '',
  chest: '',
  waist: '',
  hips: '',
  shoulder: '',
  inseam: '',
}

const USERS_STORAGE_KEY = 'velour-users'
const SESSION_STORAGE_KEY = 'velour-session'
const ADMIN_INVITATION_CODE = 'VELOUR-ADMIN'

interface SessionInfo {
  email: string
  role: UserRole
}

function getSessionInfo(): SessionInfo | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')
    if (typeof session?.email !== 'string' || !['client', 'admin'].includes(session.role)) return null
    return { email: session.email, role: session.role }
  } catch {
    return null
  }
}

function storeSessionInfo(session: SessionInfo) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event('velour-session-change'))
}

function getStoredUsers(): StoredUser[] {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]')
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateMeasurements(measurements: UserMeasurements) {
  const ranges: Record<keyof Omit<UserMeasurements, 'gender'>, [number, number]> = {
    height: [100, 250], weight: [25, 300], chest: [40, 200], waist: [40, 200],
    hips: [40, 220], shoulder: [20, 100], inseam: [30, 150],
  }
  return Object.entries(ranges).find(([key, [min, max]]) => {
    const value = Number(measurements[key as keyof typeof ranges])
    return !Number.isFinite(value) || value < min || value > max
  })?.[0]
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  { id: 1, name: 'Blazer Estructurado', category: 'Blazers', price: 189, img: 'https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?w=600&h=750&fit=crop&auto=format', tag: 'Nuevo' },
  { id: 2, name: 'Gabardina Clásica', category: 'Abrigos', price: 245, img: 'https://images.unsplash.com/photo-1601762603339-fd61e28b698a?w=600&h=750&fit=crop&auto=format', tag: 'Destacado' },
  { id: 3, name: 'Vestido Minimalista', category: 'Vestidos', price: 134, img: 'https://images.unsplash.com/photo-1659522761084-79196b64abe4?w=600&h=750&fit=crop&auto=format' },
  { id: 4, name: 'Conjunto Neutro', category: 'Conjuntos', price: 210, img: 'https://images.unsplash.com/photo-1614028609503-590a6a47146a?w=600&h=750&fit=crop&auto=format', tag: 'Top ventas' },
  { id: 5, name: 'Camisa Lino Premium', category: 'Camisas', price: 98, img: 'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=600&h=750&fit=crop&auto=format' },
  { id: 6, name: 'Pantalón Wide Leg', category: 'Pantalones', price: 142, img: 'https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7?w=600&h=750&fit=crop&auto=format', tag: 'Nuevo' },
  { id: 7, name: 'Vestido Fluido', category: 'Vestidos', price: 156, img: 'https://images.unsplash.com/photo-1549570652-97324981a6fd?w=600&h=750&fit=crop&auto=format' },
  { id: 8, name: 'Chaqueta Oversized', category: 'Blazers', price: 178, img: 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=600&h=750&fit=crop&auto=format' },
]

const CATEGORIES = ['Todos', 'Blazers', 'Abrigos', 'Vestidos', 'Conjuntos', 'Camisas', 'Pantalones']
const CATEGORY_SLOT_TYPES: Record<string, 'superior' | 'inferior' | 'calzado' | 'abrigo' | 'cuerpo_entero' | 'accesorio'> = {
  Blazers: 'superior',
  Abrigos: 'abrigo',
  Vestidos: 'cuerpo_entero',
  Conjuntos: 'cuerpo_entero',
  Camisas: 'superior',
  Pantalones: 'inferior',
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL']
const PRICE_STORAGE_SCALE = 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)
}

function createSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function fetchProductsFromSupabase() {
  const withImages = await supabase
    .from('productos')
    .select('id, nombre, precio_base, stock, etiqueta, imagen_url, categorias(id, nombre)')
    .order('id')

  const missingImageColumn = withImages.error?.message.includes('imagen_url')
    && (withImages.error.code === '42703' || withImages.error.code === 'PGRST204')
  if (!missingImageColumn) {
    return withImages
  }

  return supabase
    .from('productos')
    .select('id, nombre, precio_base, stock, etiqueta, categorias(id, nombre)')
    .order('id')
}

function useGsapEntrance(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }
      )
    })
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ page, setPage, cartCount, session }: { page: Page; setPage: (p: Page) => void; cartCount: number; session: SessionInfo | null }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuRef.current) return
    if (menuOpen) {
      gsap.fromTo(menuRef.current, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
    }
  }, [menuOpen])

  const navLinks: { label: string; page: Page }[] = [
    { label: 'Inicio', page: 'home' },
    { label: 'Productos', page: 'products' },
    { label: 'Mi Avatar', page: 'avatar' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#DDD9D0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <button
          onClick={() => setPage('home')}
          className="font-display text-xl font-700 tracking-tight text-[#0D0D0D] hover:text-[#C9A96E] transition-colors"
          aria-label="VELOUR — Inicio"
        >
          VELOUR
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <button
              key={l.page}
              onClick={() => setPage(l.page)}
              className={`text-sm font-500 tracking-wide transition-colors ${page === l.page ? 'text-[#C9A96E]' : 'text-[#6B6860] hover:text-[#0D0D0D]'}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(session ? 'account' : 'login')}
            className="hidden md:flex items-center gap-1.5 text-sm font-500 text-[#6B6860] hover:text-[#0D0D0D] transition-colors"
            aria-label={session ? 'Mi cuenta' : 'Iniciar sesión'}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span>{session ? 'Mi cuenta' : 'Cuenta'}</span>
          </button>

          <button
            onClick={() => setPage('cart')}
            className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#F2EFE9] transition-colors"
            aria-label={`Carrito, ${cartCount} artículos`}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#C9A96E] text-white text-[10px] font-700 rounded-full flex items-center justify-center leading-none">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#F2EFE9]"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
              {menuOpen
                ? <path d="M6 18L18 6M6 6l12 12"/>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div ref={menuRef} className="md:hidden border-t border-[#DDD9D0] bg-[#FAF8F5] px-4 py-4 flex flex-col gap-2">
          {navLinks.map(l => (
            <button
              key={l.page}
              onClick={() => { setPage(l.page); setMenuOpen(false) }}
              className={`text-left text-sm font-500 py-2 ${page === l.page ? 'text-[#C9A96E]' : 'text-[#6B6860]'}`}
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => { setPage(session ? 'account' : 'login'); setMenuOpen(false) }}
            className="text-left text-sm font-500 py-2 text-[#6B6860]"
          >
            {session ? 'Mi cuenta' : 'Iniciar sesión'}
          </button>
        </div>
      )}
    </nav>
  )
}

// ─── WhatsApp FAB ─────────────────────────────────────────────────────────────

function WhatsAppFAB() {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(ref.current, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)', delay: 1 })
  }, [])

  return (
    <a
      ref={ref}
      href="https://wa.me/?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20sus%20productos"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 hover:shadow-xl transition-all duration-200"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.845L.057 23.547a.5.5 0 00.603.617l5.882-1.543A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.93 0-3.74-.524-5.287-1.434l-.378-.224-3.924 1.03 1.044-3.82-.247-.396A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    </a>
  )
}

// ─── Marquee Banner ───────────────────────────────────────────────────────────

function MarqueeBanner() {
  const items = ['NUEVA COLECCIÓN 2025', 'ENVÍO GRATIS DESDE S/ 200', 'AVATAR VIRTUAL', 'MODA SOSTENIBLE', 'PRUEBA VIRTUAL', 'DISEÑO EXCLUSIVO']
  const doubled = [...items, ...items]
  return (
    <div className="bg-[#0D0D0D] text-[#C9A96E] text-xs font-600 tracking-[0.2em] uppercase py-2.5 overflow-hidden">
      <div className="flex gap-16 marquee-track whitespace-nowrap w-max">
        {doubled.map((t, i) => (
          <span key={i} className="shrink-0">
            {t} <span className="text-[#C9A96E]/40 mx-6">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ setPage, products }: { setPage: (p: Page) => void; products: Product[] }) {
  const heroRef = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.fromTo(heroTextRef.current,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 }
      )
      // Feature cards scroll trigger
      if (featuresRef.current) {
        gsap.fromTo(
          featuresRef.current.querySelectorAll('.feature-card'),
          { opacity: 0, y: 36 },
          {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out',
            scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' }
          }
        )
      }
    })
    return () => ctx.revert()
  }, [])

  const featured = products.slice(0, 4)

  return (
    <div>
      <MarqueeBanner />

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-[92vh] flex items-end overflow-hidden bg-[#0D0D0D]">
        <img
          src="https://images.unsplash.com/photo-1603400521630-9f2de124b33b?w=1400&h=900&fit=crop&auto=format"
          alt="Colección VELOUR — prendas de diseño exclusivo"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/20 to-transparent" />

        <div ref={heroTextRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-20 w-full">
          <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-4">Colección Otoño 2025</p>
          <h1 className="font-display text-white text-5xl sm:text-7xl lg:text-8xl font-700 leading-[0.9] mb-6 max-w-3xl">
            La moda que<br /><em className="italic text-[#C9A96E]">te define</em>
          </h1>
          <p className="text-white/70 text-base sm:text-lg max-w-md mb-10 font-300 leading-relaxed">
            Prendas diseñadas para quienes saben lo que quieren. Calidad premium, ajuste perfecto con tu avatar virtual.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setPage('products')}
              className="bg-[#C9A96E] text-[#0D0D0D] px-7 py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#b8955c] transition-colors"
            >
              Ver Colección
            </button>
            <button
              onClick={() => setPage('avatar')}
              className="border border-white/40 text-white px-7 py-3.5 text-sm font-600 tracking-wide uppercase hover:border-white hover:bg-white/10 transition-all"
            >
              Crear mi Avatar
            </button>
          </div>
        </div>
      </section>

      {/* About / Features */}
      <section ref={featuresRef} className="bg-[#FAF8F5] py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
            <div>
              <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-4">Sobre VELOUR</p>
              <h2 className="font-display text-4xl sm:text-5xl font-700 leading-tight mb-6 text-[#0D0D0D]">
                Diseño con<br />propósito real
              </h2>
              <p className="text-[#6B6860] text-base leading-relaxed mb-4">
                En VELOUR creemos que la ropa es una extensión de quien eres. Fundada en 2018, nuestra marca nació con una misión clara: hacer que cada prenda se sienta hecha para ti.
              </p>
              <p className="text-[#6B6860] text-base leading-relaxed mb-8">
                Con nuestra tecnología de <strong className="text-[#0D0D0D] font-600">avatar biométrico</strong>, puedes visualizar exactamente cómo lucirá cada prenda antes de comprar. Cero sorpresas, solo moda perfecta.
              </p>
              <button
                onClick={() => setPage('avatar')}
                className="text-sm font-600 text-[#0D0D0D] border-b-2 border-[#C9A96E] pb-0.5 hover:text-[#C9A96E] transition-colors tracking-wide"
              >
                Crear mi Avatar Virtual →
              </button>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&h=600&fit=crop&auto=format"
                alt="Interior de tienda VELOUR con racks de ropa de diseño"
                className="w-full h-80 sm:h-96 object-cover"
              />
              <div className="absolute -bottom-4 -left-4 bg-[#C9A96E] text-[#0D0D0D] p-4 font-display text-lg font-700">
                + 500<br /><span className="font-body text-xs font-500 tracking-wide uppercase">prendas únicas</span>
              </div>
            </div>
          </div>

          {/* Value props */}
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '◈', title: 'Avatar Personalizado', desc: 'Ingresa tus medidas y visualiza las prendas sobre tu figura exacta antes de comprar.' },
              { icon: '◉', title: 'Ajuste Garantizado', desc: 'Nuestro sistema de tallas inteligente te recomienda el fit perfecto según tu cuerpo.' },
              { icon: '◎', title: 'Calidad Premium', desc: 'Materiales de primera selección en cada prenda. Sostenibles y duraderos.' },
            ].map(f => (
              <div key={f.title} className="feature-card border border-[#DDD9D0] p-7 hover:border-[#C9A96E] hover:shadow-sm transition-all group">
                <span className="text-[#C9A96E] text-2xl mb-4 block">{f.icon}</span>
                <h3 className="font-display text-lg font-600 mb-2 text-[#0D0D0D]">{f.title}</h3>
                <p className="text-[#6B6860] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-[#F2EFE9] py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Selección Especial</p>
              <h2 className="font-display text-3xl sm:text-4xl font-700 text-[#0D0D0D]">Lo más buscado</h2>
            </div>
            <button onClick={() => setPage('products')} className="text-sm font-500 text-[#6B6860] hover:text-[#0D0D0D] transition-colors hidden sm:block">
              Ver todo →
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map(p => (
              <ProductCard key={p.id} product={p} onTryOn={() => setPage('tryon')} compact />
            ))}
          </div>
          <button onClick={() => setPage('products')} className="mt-8 sm:hidden text-sm font-500 text-[#6B6860] hover:text-[#0D0D0D]">
            Ver todos los productos →
          </button>
        </div>
      </section>

      {/* Banner */}
      <section className="bg-[#0D0D0D] py-20 px-4 sm:px-6 text-center">
        <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-4">Tecnología VELOUR</p>
        <h2 className="font-display text-white text-4xl sm:text-5xl font-700 mb-4">
          Pruébate la ropa<br />antes de comprar
        </h2>
        <p className="text-white/60 text-base max-w-md mx-auto mb-10 font-300">
          Crea tu avatar con tus medidas exactas y visualiza cómo te queda cada prenda en segundos.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => setPage('register')} className="bg-[#C9A96E] text-[#0D0D0D] px-8 py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#b8955c] transition-colors">
            Crear Cuenta Gratis
          </button>
          <button onClick={() => setPage('login')} className="border border-white/30 text-white px-8 py-3.5 text-sm font-600 tracking-wide uppercase hover:border-white/60 transition-colors">
            Iniciar Sesión
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0D0D0D] border-t border-white/10 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-white text-lg font-700">VELOUR</span>
          <p className="text-white/40 text-xs">© 2025 VELOUR. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            {['Instagram', 'TikTok', 'Pinterest'].map(s => (
              <a key={s} href="#" className="text-white/40 hover:text-[#C9A96E] text-xs transition-colors">{s}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product, onAddToCart, onTryOn, compact = false
}: {
  product: Product
  onAddToCart?: (p: Product, size: string) => boolean
  onTryOn?: () => void
  compact?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [selectedSize, setSelectedSize] = useState('M')
  const [added, setAdded] = useState(false)
  const [stockError, setStockError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const availableStock = product.stock ?? 0

  useEffect(() => {
    if (!overlayRef.current) return
    gsap.to(overlayRef.current, {
      opacity: hovered ? 1 : 0,
      y: hovered ? 0 : 8,
      duration: 0.25,
      ease: 'power2.out'
    })
  }, [hovered])

  function handleAdd() {
    if (onAddToCart) {
      const wasAdded = onAddToCart(product, selectedSize)
      setStockError(wasAdded ? '' : 'Stock insuficiente')
      if (wasAdded) {
        setAdded(true)
        setTimeout(() => setAdded(false), 1500)
      }
    }
  }

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative overflow-hidden bg-[#E8E4DC] mb-3">
        <img
          src={product.img}
          alt={product.name}
          className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${compact ? 'h-64 sm:h-72' : 'h-72 sm:h-80'}`}
        />
        {product.tag && (
          <span className="absolute top-3 left-3 bg-[#0D0D0D] text-[#C9A96E] text-[10px] font-700 tracking-widest uppercase px-2 py-1">
            {product.tag}
          </span>
        )}

        {/* Overlay actions */}
        <div ref={overlayRef} className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0D0D0D]/80 to-transparent opacity-0">
          {!compact && (
            <div className="flex gap-1.5 mb-2">
              {SIZES.map(s => (
                <button
                  key={s}
                  onClick={e => { e.stopPropagation(); setSelectedSize(s) }}
                  className={`text-xs px-2.5 py-1 border transition-colors ${selectedSize === s ? 'bg-[#C9A96E] border-[#C9A96E] text-[#0D0D0D]' : 'border-white/40 text-white hover:border-white'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {onAddToCart && (
              <button
                onClick={e => { e.stopPropagation(); handleAdd() }}
                disabled={availableStock < 1}
                className={`flex-1 py-2.5 text-xs font-600 tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:bg-[#DDD9D0] disabled:text-[#6B6860] ${added ? 'bg-[#C9A96E] text-[#0D0D0D]' : 'bg-white text-[#0D0D0D] hover:bg-[#C9A96E]'}`}
              >
                {availableStock < 1 ? 'Agotado' : added ? '✓ Agregado' : 'Agregar'}
              </button>
            )}
            {onTryOn && (
              <button
                onClick={e => { e.stopPropagation(); onTryOn() }}
                className="flex-1 py-2.5 text-xs font-600 tracking-wide uppercase bg-transparent border border-white/60 text-white hover:border-[#C9A96E] hover:text-[#C9A96E] transition-colors"
              >
                Probarse
              </button>
            )}
          </div>
          {onAddToCart && (
            <p className="mt-2 text-[10px] text-[#6B6860]">
              {stockError || `${availableStock} unidades disponibles`}
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-[#6B6860] text-[11px] font-500 tracking-widest uppercase mb-0.5">{product.category}</p>
        <h3 className="font-display text-[#0D0D0D] text-base font-600 mb-1">{product.name}</h3>
        <p className="text-[#0D0D0D] text-sm font-500">{formatPrice(product.price)}</p>
      </div>
    </div>
  )
}

// ─── Products Page ────────────────────────────────────────────────────────────

function ProductsPage({ setPage, addToCart, products }: { setPage: (p: Page) => void; addToCart: (p: Product, size: string) => boolean; products: Product[] }) {
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const pageRef = useGsapEntrance([])

  const categories = ['Todos', ...new Set(products.map(product => product.category))]
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'Todos' || p.category === activeCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  useEffect(() => {
    if (!gridRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        gridRef.current!.querySelectorAll('.product-item'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }
      )
    })
    return () => ctx.revert()
  }, [activeCategory, search])

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16">
      <MarqueeBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Catálogo</p>
          <h1 className="font-display text-4xl sm:text-5xl font-700 text-[#0D0D0D] mb-6">Todas las prendas</h1>

          {/* Search */}
          <div className="relative max-w-sm mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6860]" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar prendas..."
              aria-label="Buscar prendas"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#DDD9D0] bg-white focus:border-[#C9A96E] focus:outline-none transition-colors"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-4 py-2 text-xs font-600 tracking-wide uppercase border transition-all ${activeCategory === c ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'bg-white text-[#6B6860] border-[#DDD9D0] hover:border-[#0D0D0D]'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(p => (
            <div key={p.id} className="product-item">
              <ProductCard product={p} onAddToCart={addToCart} onTryOn={() => setPage('tryon')} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-24 text-[#6B6860]">
            <p className="font-display text-2xl mb-2">Sin resultados</p>
            <p className="text-sm">Intenta con otra búsqueda o categoría</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cart Page ────────────────────────────────────────────────────────────────

function CartPage({ cart, setCart, setPage, onCheckout }: {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  setPage: (p: Page) => void
  onCheckout: () => void
}) {
  const pageRef = useGsapEntrance([])
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const stockIsValid = cart.every(item => (
    cart.filter(cartItem => cartItem.id === item.id).reduce((sum, cartItem) => sum + cartItem.qty, 0)
    <= (item.stock ?? 0)
  ))

  function remove(id: Product['id'], size: string) {
    setCart(c => c.filter(i => !(i.id === id && i.size === size)))
  }

  function updateQty(id: Product['id'], size: string, delta: number) {
    setCart(c => c.map(i => {
      if (i.id === id && i.size === size) {
        const qty = Math.max(1, Math.min(i.stock ?? 0, i.qty + delta))
        return { ...i, qty }
      }
      return i
    }))
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Tu selección</p>
        <h1 className="font-display text-4xl sm:text-5xl font-700 text-[#0D0D0D] mb-10">Carrito</h1>

        {cart.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-[#DDD9D0] text-8xl mb-6">◻</div>
            <p className="font-display text-2xl text-[#0D0D0D] mb-2">Tu carrito está vacío</p>
            <p className="text-[#6B6860] text-sm mb-8">Explora nuestra colección y agrega prendas que te inspiren</p>
            <button onClick={() => setPage('products')} className="bg-[#0D0D0D] text-white px-8 py-3 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
              Ver productos
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map(item => (
                <div key={`${item.id}-${item.size}`} className="flex gap-4 p-4 bg-white border border-[#DDD9D0] hover:border-[#C9A96E] transition-colors">
                  <img src={item.img} alt={item.name} className="w-20 h-24 sm:w-24 sm:h-28 object-cover bg-[#E8E4DC] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#6B6860] text-[10px] font-600 tracking-widest uppercase mb-0.5">{item.category}</p>
                    <h3 className="font-display font-600 text-[#0D0D0D] truncate mb-1">{item.name}</h3>
                    <p className="text-[#6B6860] text-xs mb-3">Talla: {item.size}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-[#DDD9D0]">
                        <button onClick={() => updateQty(item.id, item.size, -1)} className="w-7 h-7 flex items-center justify-center text-[#6B6860] hover:text-[#0D0D0D] hover:bg-[#F2EFE9] transition-colors" aria-label="Reducir cantidad">−</button>
                        <span className="w-8 text-center text-sm font-500">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.size, 1)} disabled={item.qty >= (item.stock ?? 0)} className="w-7 h-7 flex items-center justify-center text-[#6B6860] hover:text-[#0D0D0D] hover:bg-[#F2EFE9] transition-colors disabled:cursor-not-allowed disabled:opacity-40" aria-label="Aumentar cantidad">+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-600 text-[#0D0D0D]">{formatPrice(item.price * item.qty)}</span>
                        <button onClick={() => remove(item.id, item.size)} className="text-[#6B6860] hover:text-red-500 transition-colors text-xs" aria-label={`Eliminar ${item.name}`}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-[#0D0D0D] text-white p-6 h-fit sticky top-24">
              <h2 className="font-display text-xl font-700 mb-6">Resumen</h2>
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} artículos)</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Envío</span>
                  <span className="text-[#C9A96E]">{total >= 200 ? 'Gratis' : formatPrice(15)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-600">
                  <span>Total</span>
                  <span>{formatPrice(total + (total >= 200 ? 0 : 15))}</span>
                </div>
              </div>
              {total >= 200 && (
                <p className="text-[#C9A96E] text-xs mb-4 text-center">◆ Envío gratis aplicado</p>
              )}
              {!stockIsValid && <p className="mb-3 text-xs text-rose-300">El stock disponible cambió. Ajusta las cantidades antes de pagar.</p>}
              <button onClick={onCheckout} disabled={!stockIsValid} className="w-full bg-[#C9A96E] text-[#0D0D0D] py-3.5 text-sm font-700 tracking-wide uppercase hover:bg-[#b8955c] transition-colors mb-3 disabled:cursor-not-allowed disabled:opacity-50">
                Proceder al pago →
              </button>
              <button onClick={() => setPage('products')} className="w-full border border-white/20 text-white/70 py-3 text-xs font-500 tracking-wide uppercase hover:border-white/40 transition-colors">
                Seguir comprando
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ setPage, returnPage, onAuthenticated }: { setPage: (p: Page) => void; returnPage: Page | null; onAuthenticated: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [loading, setLoading] = useState(false)
  const pageRef = useGsapEntrance([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setNeedsConfirmation(false)

    const normalizedEmail = email.trim().toLowerCase()

    if (!isValidEmail(normalizedEmail)) {
      setError('Ingresa un correo electrónico válido.')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (authError || !authData.user) {
        throw authError ?? new Error('No se pudo iniciar sesión.')
      }

      const { data: profileData, error: profileError } = await supabase
        .from('perfiles')
        .select('id, correo, nombre, apellido, rol')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile lookup error:', profileError)
      }

      const profileRole = String(profileData?.rol ?? role).toLowerCase()

      if (role === 'admin' && profileRole !== 'admin') {
        await supabase.auth.signOut()
        setError('No existe una cuenta de administrador con esas credenciales.')
        return
      }

      storeSessionInfo({
        email: authData.user.email || normalizedEmail,
        role: profileRole === 'admin' ? 'admin' : 'client',
      })
      sessionStorage.removeItem(BODY_STORAGE_KEY)

      onAuthenticated()
      setPage(profileRole === 'admin' ? 'admin' : returnPage ?? 'home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión.'
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      if (code === 'email_not_confirmed' || message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true)
        setError('Confirma tu correo electrónico antes de iniciar sesión.')
      } else {
        setError(message.includes('Invalid login credentials') ? `No existe una cuenta de ${role === 'admin' ? 'administrador' : 'cliente'} con esas credenciales.` : message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function resendConfirmation() {
    setResending(true)
    setError('')
    setNotice('')
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (resendError) throw resendError
      setNotice('Enviamos un nuevo correo de confirmación. Revisa también la carpeta de spam.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el correo de confirmación.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0D0D0D] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1549570652-97324981a6fd?w=800&h=1000&fit=crop&auto=format"
          alt="Modelo con vestido de la colección VELOUR"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D]/60 to-transparent" />
        <div className="relative z-10 p-12 flex flex-col justify-end">
          <span className="font-display text-white text-3xl font-700">VELOUR</span>
          <p className="text-white/60 text-sm mt-2">La moda que te define</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Bienvenido de vuelta</p>
            <h1 className="font-display text-3xl font-700 text-[#0D0D0D]">Iniciar Sesión</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <p className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Tipo de cuenta</p>
              <div className="grid grid-cols-2 gap-3">
                {(['client', 'admin'] as const).map(option => (
                  <button key={option} type="button" onClick={() => setRole(option)}
                    className={`py-3 text-sm font-600 border transition-colors ${role === option ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'bg-white text-[#6B6860] border-[#DDD9D0]'}`}>
                    {option === 'client' ? 'Cliente' : 'Administrador'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="login-email" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-[#DDD9D0] text-sm text-[#0D0D0D] placeholder-[#6B6860]/50 focus:border-[#C9A96E] focus:outline-none bg-white transition-colors"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Contraseña</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-[#DDD9D0] text-sm text-[#0D0D0D] placeholder-[#6B6860]/50 focus:border-[#C9A96E] focus:outline-none bg-white transition-colors"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[#C9A96E]" />
                <span className="text-[#6B6860]">Recordarme</span>
              </label>
              <button type="button" onClick={() => setPage('forgot-password')} className="text-[#C9A96E] hover:underline text-left">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            {needsConfirmation && <button type="button" onClick={resendConfirmation} disabled={resending} className="w-full text-sm text-[#0D0D0D] underline disabled:opacity-50">{resending ? 'Reenviando...' : 'Reenviar correo de confirmación'}</button>}
            {notice && <p role="status" className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2">{notice}</p>}
            </button>
            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
          </form>

          <div className="mt-6 pt-6 border-t border-[#DDD9D0] text-center">
            <p className="text-sm text-[#6B6860]">
              ¿No tienes cuenta?{' '}
              <button onClick={() => setPage('register')} className="text-[#0D0D0D] font-600 hover:text-[#C9A96E] transition-colors">
                Crear cuenta
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountPage({ session, setPage, onLogout }: { session: SessionInfo | null; setPage: (page: Page) => void; onLogout: () => Promise<void> }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    setError('')
    try {
      await onLogout()
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'No se pudo cerrar la sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-16 px-4 py-12">
      <section className="max-w-xl mx-auto bg-white border border-[#DDD9D0] p-8">
        <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Mi cuenta</p>
        <h1 className="font-display text-3xl font-700 text-[#0D0D0D] mb-6">Sesión iniciada</h1>
        {session ? (
          <>
            <p className="text-sm text-[#6B6860] mb-1">Correo electrónico</p>
            <p className="text-[#0D0D0D] font-600 break-all">{session.email}</p>
            <p className="text-sm text-[#6B6860] mt-4 mb-1">Tipo de cuenta</p>
            <p className="text-[#0D0D0D] font-600">{session.role === 'admin' ? 'Administrador' : 'Cliente'}</p>
          </>
        ) : (
          <p className="text-sm text-[#6B6860]">No hay una sesión activa. Inicia sesión para acceder a tu cuenta.</p>
        )}

        {error && <p role="alert" className="mt-5 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        <div className="mt-8 flex flex-col gap-3">
          {session?.role === 'client' && (
            <button onClick={() => setPage('avatar')} className="w-full bg-[#C9A96E] py-3 text-sm font-700 uppercase tracking-wide text-[#0D0D0D] hover:bg-[#b8955c]">
              Ver o editar mi avatar
            </button>
          )}
          {!session && (
            <button onClick={() => setPage('login')} className="w-full bg-[#0D0D0D] py-3 text-sm font-700 uppercase tracking-wide text-white hover:bg-[#C9A96E] hover:text-[#0D0D0D]">
              Iniciar sesión
            </button>
          )}
          {session && (
            <button onClick={() => void handleLogout()} disabled={loading} className="w-full border border-[#DDD9D0] py-3 text-sm font-600 uppercase tracking-wide text-[#6B6860] hover:border-[#0D0D0D] disabled:opacity-50">
              {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          )}
          <button onClick={() => setPage('home')} className="text-sm text-[#6B6860] hover:text-[#0D0D0D]">
            Volver a la tienda
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── Register Page ────────────────────────────────────────────────────────────

function RegisterPage({ setPage, returnPage, onAuthenticated }: { setPage: (p: Page) => void; returnPage: Page | null; onAuthenticated: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '', role: 'client' as UserRole, adminCode: '' })
  const [measurements, setMeasurements] = useState<UserMeasurements>(DEFAULT_MEASUREMENTS)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [loading, setLoading] = useState(false)
  const pageRef = useGsapEntrance([])
  const formRef = useRef<HTMLFormElement>(null)

  function update(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function updateMeasurement(k: keyof UserMeasurements, v: string) { setMeasurements(m => ({ ...m, [k]: v })) }

  async function submitAccount() {
    const email = form.email.trim().toLowerCase()
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const fullName = `${firstName} ${lastName}`

    setLoading(true)

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: fullName,
            nombre: firstName || 'Usuario',
            apellido: lastName || '',
            role: form.role,
            rol: form.role,
            genero: form.role === 'admin' ? 'unisex' : measurements.gender,
            medidas: form.role === 'admin' ? null : measurements,
          },
        },
      })

      if (signUpError) throw signUpError
      if (!signUpData.user) throw new Error('No se pudo crear la cuenta.')

      if (!signUpData.session) {
        setConfirmationPending(true)
        setNotice(`Cuenta creada. Confirma el correo enviado a ${email} antes de iniciar sesión.`)
        return
      }

      storeSessionInfo({ email, role: form.role })
      onAuthenticated()
      setPage(form.role === 'admin' ? 'admin' : returnPage ?? 'home')
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email, role: form.role }))
      sessionStorage.removeItem(BODY_STORAGE_KEY)
      if (form.role !== 'admin') {
        localStorage.setItem('velour-temp-measurements', JSON.stringify(measurements))
      }
      setPage(form.role === 'admin' ? 'admin' : 'avatar')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar el registro.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function resendConfirmation() {
    setResending(true)
    setError('')
    setNotice('')
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: form.email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (resendError) throw resendError
      setNotice('Enviamos un nuevo correo de confirmación. Revisa también la carpeta de spam.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el correo de confirmación.')
    } finally {
      setResending(false)
    }
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.firstName.trim().length < 2) return setError('Ingresa tu nombre.')
    if (form.lastName.trim().length < 2) return setError('Ingresa tu apellido.')
    if (!isValidEmail(form.email.trim())) return setError('Ingresa un correo electrónico válido.')
    if (form.role === 'admin' && form.adminCode !== ADMIN_INVITATION_CODE) return setError('El código de invitación de administrador no es válido.')
    if (formRef.current) {
      gsap.fromTo(formRef.current, { x: 0 }, { x: -20, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => {
        setStep(2)
        gsap.fromTo(formRef.current, { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
      }})
    } else {
      setStep(2)
    }
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.')

    if (form.role === 'admin') {
      submitAccount()
      return
    }

    setStep(3)
  }

  function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const invalidMeasurement = validateMeasurements(measurements)
    if (invalidMeasurement) return setError('Revisa las medidas: deben estar dentro de un rango válido y en las unidades indicadas.')
    submitAccount()
  }

  const measurementFields: { key: keyof Omit<UserMeasurements, 'gender'>; label: string; placeholder: string; unit: string }[] = [
    { key: 'height', label: 'Estatura', placeholder: '165', unit: 'cm' },
    { key: 'weight', label: 'Peso', placeholder: '60', unit: 'kg' },
    { key: 'chest', label: 'Contorno de pecho', placeholder: '90', unit: 'cm' },
    { key: 'waist', label: 'Contorno de cintura', placeholder: '70', unit: 'cm' },
    { key: 'hips', label: 'Contorno de cadera', placeholder: '95', unit: 'cm' },
    { key: 'shoulder', label: 'Ancho de hombros', placeholder: '38', unit: 'cm' },
    { key: 'inseam', label: 'Largo de entrepierna', placeholder: '75', unit: 'cm' },
  ]

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#F2EFE9] relative overflow-hidden flex-col justify-end p-12">
        <img
          src="https://images.unsplash.com/photo-1614028609503-590a6a47146a?w=800&h=1000&fit=crop&auto=format"
          alt="Colección VELOUR"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="relative z-10">
          <span className="font-display text-[#0D0D0D] text-3xl font-700">VELOUR</span>
          <p className="text-[#6B6860] text-sm mt-2 max-w-xs">Únete y descubre una experiencia de moda única con tu avatar personalizado.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 transition-all ${step >= n ? 'bg-[#C9A96E] text-[#0D0D0D]' : 'bg-[#DDD9D0] text-[#6B6860]'}`}>{n}</div>
                {n < 3 && <div className={`h-px w-12 transition-all ${step > n ? 'bg-[#C9A96E]' : 'bg-[#DDD9D0]'}`} />}
              </div>
            ))}
            <span className="ml-2 text-xs text-[#6B6860]">{step === 1 ? 'Datos básicos' : step === 2 ? 'Contraseña' : 'Medidas biométricas'}</span>
          </div>

          <div className="mb-8">
            <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Únete a VELOUR</p>
            <h1 className="font-display text-3xl font-700 text-[#0D0D0D]">Crear Cuenta</h1>
          </div>

          {step === 1 ? (
            <form ref={formRef} onSubmit={handleStep1} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-first-name" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Nombre</label>
                  <input id="reg-first-name" type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Ana" required autoComplete="given-name"
                    className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                </div>
                <div>
                  <label htmlFor="reg-last-name" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Apellido</label>
                  <input id="reg-last-name" type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="García" required autoComplete="family-name"
                    className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                </div>
              </div>
              <div>
                <p className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Tipo de cuenta</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['client', 'admin'] as const).map(option => (
                    <button key={option} type="button" onClick={() => update('role', option)} className={`py-3 text-sm font-600 border transition-colors ${form.role === option ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'bg-white text-[#6B6860] border-[#DDD9D0]'}`}>
                      {option === 'client' ? 'Cliente' : 'Administrador'}
                    </button>
                  ))}
                </div>
              </div>
              {form.role === 'admin' && <div><label htmlFor="reg-admin-code" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Código de invitación</label><input id="reg-admin-code" type="password" value={form.adminCode} onChange={e => update('adminCode', e.target.value)} required className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white" /></div>}
              <div>
                <label htmlFor="reg-email" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Correo electrónico</label>
                <input id="reg-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="tu@correo.com" required autoComplete="email"
                  className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
              </div>
              <button type="submit" className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors mt-2">
                Continuar
              </button>
            </form>
          ) : step === 2 ? (
            <form ref={formRef} onSubmit={handleStep2} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reg-password" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Contraseña</label>
                <input id="reg-password" type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Mínimo 8 caracteres" required autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
              </div>
              <div>
                <label htmlFor="reg-confirm" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Confirmar contraseña</label>
                <input id="reg-confirm" type="password" value={form.confirm} onChange={e => update('confirm', e.target.value)} placeholder="Repite tu contraseña" required autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
              </div>
              {form.role === 'admin' && (
                <p className="text-xs text-[#6B6860]">La cuenta de administrador entra directamente al panel sin crear avatar ni registrar medidas.</p>
              )}
              <p className="text-xs text-[#6B6860]">
                Al crear tu cuenta aceptas nuestros <a href="#" className="text-[#C9A96E] hover:underline">Términos de uso</a> y <a href="#" className="text-[#C9A96E] hover:underline">Política de privacidad</a>.
              </p>
              <button type="submit" disabled={loading || confirmationPending}
                className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50 mt-2">
                {form.role === 'admin' ? 'Crear cuenta' : 'Continuar a medidas'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-[#6B6860] hover:text-[#0D0D0D] transition-colors py-2">
                ← Volver
              </button>
            </form>
          ) : (
            <form ref={formRef} onSubmit={handleStep3} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><p className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Sexo</p><div className="grid grid-cols-2 gap-3">{(['F', 'M'] as const).map(g => <button key={g} type="button" onClick={() => updateMeasurement('gender', g)} className={`py-3 text-sm font-600 border ${measurements.gender === g ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'bg-white text-[#6B6860] border-[#DDD9D0]'}`}>{g === 'F' ? 'Femenino' : 'Masculino'}</button>)}</div></div>
                {measurementFields.map(field => <div key={field.key}><label htmlFor={`reg-${field.key}`} className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">{field.label}</label><div className="relative"><input id={`reg-${field.key}`} type="number" min="0" step="0.1" value={measurements[field.key]} onChange={e => updateMeasurement(field.key, e.target.value)} placeholder={field.placeholder} required className="w-full px-3 py-3 pr-10 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6860] text-xs">{field.unit}</span></div></div>)}
              </div>
              <p className="text-xs text-[#6B6860]">Tus datos biométricos se guardan junto a tu perfil para recomendarte tallas.</p>
              <button type="submit" disabled={loading || confirmationPending} className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50">{loading ? 'Creando cuenta...' : 'Crear cuenta'}</button>
              <button type="button" onClick={() => setStep(2)} className="w-full text-xs text-[#6B6860] hover:text-[#0D0D0D] transition-colors py-2">← Volver</button>
            </form>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
          {notice && <div role="status" className="mt-4 space-y-3 border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900"><p>{notice}</p>{confirmationPending && <button type="button" onClick={resendConfirmation} disabled={resending} className="font-600 underline disabled:opacity-50">{resending ? 'Reenviando...' : 'Reenviar correo de confirmación'}</button>}</div>}

          <div className="mt-6 pt-6 border-t border-[#DDD9D0] text-center">
            <p className="text-sm text-[#6B6860]">
              ¿Ya tienes cuenta?{' '}
              <button onClick={() => setPage('login')} className="text-[#0D0D0D] font-600 hover:text-[#C9A96E] transition-colors">Iniciar sesión</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Checkout Page ───────────────────────────────────────────────────────────

type CheckoutStep = 'shipping' | 'payment' | 'confirm'

function CheckoutPage({ cart, onSuccess, setPage }: { cart: CartItem[]; onSuccess: () => void; setPage: (page: Page) => void }) {
  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [processing, setProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [payMethod, setPayMethod] = useState<'card' | 'transfer' | 'yape'>('card')
  const [shipping, setShipping] = useState({ name: '', lastname: '', email: '', phone: '', address: '', city: '', dept: '', zip: '' })
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const [orderNum] = useState(() => `VL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
  const [returnCode] = useState(() => `DEV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
  const pageRef = useGsapEntrance([])
  const panelRef = useRef<HTMLDivElement>(null)

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping_fee = subtotal >= 200 ? 0 : 15
  const total = subtotal + shipping_fee

  function animateStep(next: CheckoutStep) {
    if (!panelRef.current) { setStep(next); return }
    gsap.to(panelRef.current, { x: -30, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => {
      setStep(next)
      gsap.fromTo(panelRef.current, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
    }})
  }

  function handleShipping(e: React.FormEvent) {
    e.preventDefault()
    animateStep('payment')
  }

  const spinnerRef = useRef<SVGSVGElement>(null)

  async function completePurchase() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Inicia sesión antes de realizar la compra para guardar tu pedido.')

      const { error } = await supabase.rpc('crear_pedido_con_detalles', {
        p_numero_orden: orderNum,
        p_codigo_devolucion: returnCode,
        p_monto_total: Math.round(total * PRICE_STORAGE_SCALE),
        p_direccion_envio: [
          shipping.address.trim(),
          shipping.dept.trim(),
          shipping.city.trim(),
          shipping.zip.trim(),
        ].filter(Boolean).join(', '),
        p_productos: cart.map(item => ({
          producto_id: String(item.id),
          nombre_producto: item.name,
          talla: item.size,
          cantidad: item.qty,
          precio_unitario: Math.round(item.price * PRICE_STORAGE_SCALE),
        })),
      })
      if (error) throw error
      animateStep('confirm')
    } catch (error) {
      console.error('Error registrando la compra:', error)
      const errorInfo = error && typeof error === 'object'
        ? error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
        : null
      const message = typeof error === 'string'
        ? error
        : typeof errorInfo?.message === 'string'
          ? errorInfo.message
          : error instanceof Error
            ? error.message
            : 'Supabase devolvió un error sin descripción.'
      const code = typeof errorInfo?.code === 'string' ? errorInfo.code : ''
      const details = typeof errorInfo?.details === 'string' ? errorInfo.details : ''
      const hint = typeof errorInfo?.hint === 'string' ? errorInfo.hint : ''
      const description = [message, details, hint].filter(Boolean).join(' ')

      setPaymentError(
        code === 'PGRST202' || description.includes('crear_pedido_con_detalles')
          ? `${description} Ejecuta en Supabase el SQL actualizado que crea la función crear_pedido_con_detalles y vuelve a intentar.`
          : description.toLowerCase().includes('stock')
            ? 'No hay suficiente stock para uno o más productos. Actualiza el carrito e inténtalo de nuevo.'
          : description,
      )
    } finally {
      setProcessing(false)
    }
  }

  function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    setPaymentError('')
    setProcessing(true)
    const tick = () => {
      if (spinnerRef.current) {
        gsap.fromTo(spinnerRef.current, { rotation: 0, transformOrigin: '50% 50%' }, {
          rotation: 360, duration: 1, repeat: 2, ease: 'linear',
          onComplete: () => { void completePurchase() }
        })
      } else {
        setTimeout(tick, 50)
      }
    }
    setTimeout(tick, 30)
  }

  function formatCard(v: string) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  }
  function formatExpiry(v: string) {
    return v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
  }

  const STEPS: { id: CheckoutStep; label: string }[] = [
    { id: 'shipping', label: 'Envío' },
    { id: 'payment', label: 'Pago' },
    { id: 'confirm', label: 'Confirmación' },
  ]
  const stepIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Steps indicator */}
        <div className="flex items-center gap-0 mb-10 max-w-xs">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-700 transition-all duration-300 ${stepIdx >= i ? 'bg-[#C9A96E] text-[#0D0D0D]' : 'bg-[#DDD9D0] text-[#6B6860]'}`}>
                {stepIdx > i ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px w-10 transition-all duration-500 ${stepIdx > i ? 'bg-[#C9A96E]' : 'bg-[#DDD9D0]'}`} />}
            </div>
          ))}
          <span className="ml-3 text-xs text-[#6B6860] font-500">{STEPS[stepIdx]?.label}</span>
        </div>

        {step !== 'confirm' && (
          <div className="grid lg:grid-cols-5 gap-10">
            {/* Main panel */}
            <div ref={panelRef} className="lg:col-span-3">

              {step === 'shipping' && (
                <form onSubmit={handleShipping} className="space-y-5">
                  <div>
                    <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Paso 1</p>
                    <h2 className="font-display text-3xl font-700 text-[#0D0D0D] mb-6">Datos de envío</h2>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { id: 'sh-name', label: 'Nombre', key: 'name', placeholder: 'Ana', auto: 'given-name' },
                      { id: 'sh-last', label: 'Apellido', key: 'lastname', placeholder: 'García', auto: 'family-name' },
                    ].map(f => (
                      <div key={f.id}>
                        <label htmlFor={f.id} className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">{f.label}</label>
                        <input id={f.id} type="text" required autoComplete={f.auto} placeholder={f.placeholder}
                          value={shipping[f.key as keyof typeof shipping]} onChange={e => setShipping(s => ({ ...s, [f.key]: e.target.value }))}
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sh-email" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Correo electrónico</label>
                      <input id="sh-email" type="email" required autoComplete="email" placeholder="tu@correo.com"
                        value={shipping.email} onChange={e => setShipping(s => ({ ...s, email: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                    </div>
                    <div>
                      <label htmlFor="sh-phone" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Teléfono</label>
                      <input id="sh-phone" type="tel" required autoComplete="tel" placeholder="+51 999 123 456"
                        value={shipping.phone} onChange={e => setShipping(s => ({ ...s, phone: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sh-address" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Dirección</label>
                    <input id="sh-address" type="text" required autoComplete="street-address" placeholder="Av. Larco 123, dpto. 402"
                      value={shipping.address} onChange={e => setShipping(s => ({ ...s, address: e.target.value }))}
                      className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { id: 'sh-city', label: 'Ciudad', key: 'city', placeholder: 'Lima', auto: 'address-level2' },
                      { id: 'sh-dept', label: 'Distrito', key: 'dept', placeholder: 'Miraflores', auto: 'address-level1' },
                      { id: 'sh-zip', label: 'Código postal', key: 'zip', placeholder: '15074', auto: 'postal-code' },
                    ].map(f => (
                      <div key={f.id}>
                        <label htmlFor={f.id} className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">{f.label}</label>
                        <input id={f.id} type="text" required autoComplete={f.auto} placeholder={f.placeholder}
                          value={shipping[f.key as keyof typeof shipping]} onChange={e => setShipping(s => ({ ...s, [f.key]: e.target.value }))}
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="w-full bg-[#0D0D0D] text-white py-4 text-sm font-700 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
                      Continuar al pago →
                    </button>
                  </div>
                </form>
              )}

              {step === 'payment' && (
                <form onSubmit={handlePayment} className="space-y-6">
                  <div>
                    <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Paso 2</p>
                    <h2 className="font-display text-3xl font-700 text-[#0D0D0D] mb-6">Método de pago</h2>
                  </div>

                  {/* Payment method selector */}
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'card', label: 'Tarjeta', icon: (
                        <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
                          <rect width="38" height="24" rx="4" fill="#1A1F71"/>
                          <rect y="7" width="38" height="5" fill="#F7B600" opacity="0.9"/>
                          <circle cx="26" cy="12" r="7" fill="#EB001B"/>
                          <circle cx="32" cy="12" r="7" fill="#F79E1B" opacity="0.85"/>
                        </svg>
                      )},
                      { id: 'transfer', label: 'Transferencia', icon: (
                        <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
                          <rect width="38" height="24" rx="4" fill="#D8242A"/>
                          <text x="19" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">BANCOS</text>
                        </svg>
                      )},
                      { id: 'yape', label: 'Yape', icon: (
                        <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
                          <rect width="38" height="24" rx="4" fill="#742284"/>
                          <text x="19" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Yape</text>
                        </svg>
                      )},
                    ] as { id: 'card' | 'transfer' | 'yape'; label: string; icon: React.ReactNode }[]).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethod(m.id)}
                        className={`flex flex-col items-center gap-2 py-4 border-2 transition-all ${payMethod === m.id ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-[#DDD9D0] hover:border-[#6B6860]'}`}
                      >
                        {m.icon}
                        <span className="text-xs font-600 text-[#0D0D0D]">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {payMethod === 'card' && (
                    <div className="space-y-4">
                      {/* Card preview */}
                      <div className="relative h-40 bg-gradient-to-br from-[#0D0D0D] via-[#1a1a2e] to-[#16213e] rounded-lg p-6 overflow-hidden mb-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A96E]/10 rounded-full -translate-y-8 translate-x-8" />
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-[#C9A96E]/5 rounded-full translate-y-6 -translate-x-6" />
                        <div className="relative z-10 h-full flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <span className="font-display text-white text-lg font-700 tracking-wider">VELOUR</span>
                            <svg viewBox="0 0 50 32" width="50" height="32" aria-hidden="true">
                              <circle cx="20" cy="16" r="12" fill="#EB001B" opacity="0.9"/>
                              <circle cx="30" cy="16" r="12" fill="#F79E1B" opacity="0.85"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-white/50 text-[10px] tracking-widest uppercase mb-1">Número de tarjeta</p>
                            <p className="text-white font-mono text-base tracking-widest">
                              {card.number || '•••• •••• •••• ••••'}
                            </p>
                          </div>
                          <div className="flex justify-between">
                            <div>
                              <p className="text-white/50 text-[9px] tracking-widest uppercase mb-0.5">Titular</p>
                              <p className="text-white text-xs tracking-wide">{card.name || 'NOMBRE APELLIDO'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white/50 text-[9px] tracking-widest uppercase mb-0.5">Vence</p>
                              <p className="text-white text-xs">{card.expiry || 'MM/AA'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="card-number" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Número de tarjeta</label>
                        <input id="card-number" type="text" inputMode="numeric" placeholder="1234 5678 9012 3456" required autoComplete="cc-number"
                          value={card.number} onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm font-mono tracking-widest focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                      <div>
                        <label htmlFor="card-name" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Nombre en la tarjeta</label>
                        <input id="card-name" type="text" placeholder="ANA GARCÍA" required autoComplete="cc-name"
                          value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))}
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm tracking-wide focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="card-expiry" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Fecha de vencimiento</label>
                          <input id="card-expiry" type="text" inputMode="numeric" placeholder="MM/AA" required autoComplete="cc-exp"
                            value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                            className="w-full px-4 py-3 border border-[#DDD9D0] text-sm font-mono focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                        </div>
                        <div>
                          <label htmlFor="card-cvv" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">CVV / CVC</label>
                          <input id="card-cvv" type="password" inputMode="numeric" placeholder="•••" required autoComplete="cc-csc" maxLength={4}
                            value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            className="w-full px-4 py-3 border border-[#DDD9D0] text-sm font-mono focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  )}

                  {payMethod === 'transfer' && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="transfer-bank" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Banco</label>
                        <select id="transfer-bank" required className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors">
                          <option value="">Selecciona tu banco</option>
                          {['BCP', 'Interbank', 'BBVA Perú', 'Scotiabank', 'Banco de la Nación'].map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="transfer-dni" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">DNI</label>
                        <input id="transfer-dni" type="text" inputMode="numeric" placeholder="12345678" maxLength={8} required
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    </div>
                  )}

                  {payMethod === 'yape' && (
                    <div className="space-y-4">
                      <div className="bg-[#742284]/5 border border-[#742284]/20 p-4 text-sm text-[#6B6860]">
                        Confirma el pago de <strong className="text-[#0D0D0D">{formatPrice(total)}</strong> desde tu app Yape.
                      </div>
                      <div>
                        <label htmlFor="yape-phone" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Número asociado a Yape</label>
                        <input id="yape-phone" type="tel" inputMode="numeric" placeholder="999 123 456" pattern="[0-9 ]{9,11}" required
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm font-mono tracking-widest focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    </div>
                  )}

                  {paymentError && (
                    <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <p>No se pudo completar la compra: {paymentError}</p>
                      {paymentError.includes('Inicia sesión') && (
                        <button type="button" onClick={() => setPage('login')} className="mt-2 font-700 underline">
                          Iniciar sesión para guardar mi pedido
                        </button>
                      )}
                    </div>
                  )}

                  {/* Security badges */}
                  <div className="flex items-center gap-3 py-3 border-t border-[#DDD9D0]">
                    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><path d="M8 0L0 3v7c0 5.25 3.5 10.15 8 11.5C12.5 20.15 16 15.25 16 10V3L8 0z" fill="#C9A96E" opacity="0.8"/></svg>
                    <p className="text-[10px] text-[#6B6860]">Pago 100% seguro · Encriptación SSL 256-bit · PCI-DSS compliant</p>
                  </div>

                  <button type="button" onClick={() => setPage('products')} className="w-full border border-[#DDD9D0] px-4 py-3 text-xs font-600 uppercase tracking-wide text-[#6B6860] hover:border-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
                    ← Seguir comprando
                  </button>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => animateStep('shipping')} className="px-6 py-4 border border-[#DDD9D0] text-sm font-600 text-[#6B6860] hover:border-[#0D0D0D] hover:text-[#0D0D0D] transition-colors">
                      ← Volver
                    </button>
                    <button type="submit" disabled={processing}
                      className="flex-1 bg-[#C9A96E] text-[#0D0D0D] py-4 text-sm font-700 tracking-wide uppercase hover:bg-[#b8955c] transition-colors disabled:opacity-70 flex items-center justify-center gap-3">
                      {processing ? (
                        <>
                          <svg ref={spinnerRef} className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>
                          Procesando...
                        </>
                      ) : `Pagar ${formatPrice(total)}`}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Order summary sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#DDD9D0] p-5 sticky top-24">
                <h3 className="font-display text-lg font-700 text-[#0D0D0D] mb-4">Tu pedido</h3>
                <div className="space-y-3 mb-4 max-h-52 overflow-y-auto">
                  {cart.map(item => (
                    <div key={`${item.id}-${item.size}`} className="flex gap-3">
                      <div className="relative shrink-0">
                        <img src={item.img} alt={item.name} className="w-12 h-14 object-cover bg-[#E8E4DC]" />
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#0D0D0D] text-white text-[9px] font-700 rounded-full flex items-center justify-center">{item.qty}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-600 text-[#0D0D0D] truncate">{item.name}</p>
                        <p className="text-[10px] text-[#6B6860]">Talla {item.size}</p>
                      </div>
                      <p className="text-xs font-600 text-[#0D0D0D] shrink-0">{formatPrice(item.price * item.qty)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#DDD9D0] pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-[#6B6860]">
                    <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#6B6860]">
                    <span>Envío</span>
                    <span className={shipping_fee === 0 ? 'text-[#C9A96E]' : ''}>{shipping_fee === 0 ? 'Gratis' : formatPrice(shipping_fee)}</span>
                  </div>
                  <div className="flex justify-between font-700 text-[#0D0D0D] pt-2 border-t border-[#DDD9D0] text-base">
                    <span>Total</span><span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <ConfirmStep orderNum={orderNum} returnCode={returnCode} total={total} cart={cart} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  )
}

function ConfirmStep({ orderNum, returnCode, total, cart, onSuccess }: { orderNum: string; returnCode: string; total: number; cart: CartItem[]; onSuccess: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const checkRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      if (checkRef.current) {
        const len = 226
        gsap.set(checkRef.current, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(checkRef.current, { strokeDashoffset: 0, duration: 0.8, delay: 0.3, ease: 'power2.out' })
      }
    })
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="max-w-lg mx-auto text-center py-10">
      {/* Success icon */}
      <div className="relative w-24 h-24 mx-auto mb-8">
        <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
          <circle cx="48" cy="48" r="44" fill="#C9A96E" opacity="0.12" />
          <circle ref={checkRef} cx="48" cy="48" r="36" fill="none" stroke="#C9A96E" strokeWidth="3" />
          <path d="M30 48 L43 61 L66 38" stroke="#C9A96E" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-3">Pago aprobado</p>
      <h2 className="font-display text-4xl font-700 text-[#0D0D0D] mb-3">¡Gracias por tu compra!</h2>
      <p className="text-[#6B6860] text-sm mb-2">Tu pedido ha sido confirmado y está siendo preparado.</p>
      <div className="mb-8 space-y-2 text-sm font-600 text-[#0D0D0D]">
        <p>Número de orden: <span className="text-[#C9A96E]">{orderNum}</span></p>
        <p>Código de devolución: <span className="text-[#C9A96E]">{returnCode}</span></p>
        <p className="text-xs font-normal text-[#6B6860]">Guarda este código para identificar tu compra si solicitas una devolución o cambio.</p>
      </div>

      <div className="bg-white border border-[#DDD9D0] p-5 text-left mb-8">
        <h3 className="font-600 text-sm text-[#0D0D0D] mb-4">Resumen del pedido</h3>
        <div className="space-y-3">
          {cart.map(item => (
            <div key={`${item.id}-${item.size}`} className="flex items-center gap-3">
              <img src={item.img} alt={item.name} className="w-10 h-12 object-cover bg-[#E8E4DC] shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-600 text-[#0D0D0D]">{item.name} × {item.qty}</p>
                <p className="text-[10px] text-[#6B6860]">Talla {item.size}</p>
              </div>
              <p className="text-xs font-600">{formatPrice(item.price * item.qty)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#DDD9D0] mt-4 pt-3 flex justify-between font-700 text-sm">
          <span>Total pagado</span><span className="text-[#C9A96E]">{formatPrice(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: '📦', title: 'Preparando', desc: 'Tu pedido está siendo alistado' },
          { icon: '🚚', title: 'Envío estimado', desc: '3-5 días hábiles' },
        ].map(s => (
          <div key={s.title} className="bg-[#F2EFE9] p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xs font-600 text-[#0D0D0D] mb-0.5">{s.title}</p>
            <p className="text-[10px] text-[#6B6860]">{s.desc}</p>
          </div>
        ))}
      </div>

      <button onClick={onSuccess} className="w-full bg-[#0D0D0D] text-white py-4 text-sm font-700 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
        Seguir comprando
      </button>
    </div>
  )
}

// ─── Admin Dashboard ────────────────────────────────────────────────────────

type AdminTab = 'dashboard' | 'orders' | 'products' | 'clients' | 'returns'

function AdminDashboardPage({ setPage, onProductsChanged, session }: { setPage: (p: Page) => void; onProductsChanged: () => Promise<void>; session: SessionInfo | null }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  // States for DB data
  const [dbOrders, setDbOrders] = useState<any[]>([])
  const [dbProducts, setDbProducts] = useState<any[]>([])
  const [dbCategories, setDbCategories] = useState<any[]>([])
  const [dbClients, setDbClients] = useState<any[]>([])
  const [dbReturns, setDbReturns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const [productEditorOpen, setProductEditorOpen] = useState(false)
  const [measurementProduct, setMeasurementProduct] = useState<any | null>(null)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  const [copiedClientEmail, setCopiedClientEmail] = useState(false)
  const [productForm, setProductForm] = useState({ name: '', price: '', stock: '0', categoryId: '', tag: '', imageUrl: '' })
  const [productImageFile, setProductImageFile] = useState<File | null>(null)

  async function loadData() {
    setIsLoading(true)
    setDbError('')
    try {
      const [ordersResult, productsResult, categoriesResult, clientsResult, returnsResult] = await Promise.all([
        supabase.from('pedidos').select('id, numero_orden, monto_total, estado, creado_el, perfiles(nombre, apellido), pedido_productos(id, codigo_producto, producto_id, nombre_producto, talla, estado)').order('creado_el', { ascending: false }),
        fetchProductsFromSupabase(),
        supabase.from('categorias').select('id, nombre').order('nombre'),
        supabase.from('perfiles').select('id, nombre, apellido, correo, creado_el, pedidos(id, numero_orden, codigo_devolucion, monto_total, estado, creado_el, pedido_productos(id, codigo_producto, nombre_producto, talla, estado))'),
        supabase.from('devoluciones').select('id, codigo_devolucion, pedido_id, motivo, estado, creado_el, perfiles(nombre, apellido), variantes_producto(productos(nombre))').order('creado_el', { ascending: false }),
      ])

      const errors = [ordersResult.error, productsResult.error, categoriesResult.error, clientsResult.error, returnsResult.error].filter(Boolean)
      if (errors.length) setDbError(errors.map(error => error?.message).join(' '))
      setDbOrders(ordersResult.data ?? [])
      setDbProducts(productsResult.data ?? [])
      setDbCategories(categoriesResult.data ?? [])
      setDbClients(clientsResult.data ?? [])
      setDbReturns(returnsResult.data ?? [])
    } catch (error) {
      setDbError(error instanceof Error ? error.message : 'No se pudieron cargar los datos administrativos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  function openProductEditor(product?: any) {
    setEditingProduct(product ?? null)
    setProductImageFile(null)
    setProductForm(product ? {
      name: product.nombre,
      price: String(Number(product.precio_base) / PRICE_STORAGE_SCALE),
      stock: String(product.stock ?? 0),
      categoryId: product.categorias?.id ?? '',
      tag: product.etiqueta ?? '',
      imageUrl: product.imagen_url ?? '',
    } : { name: '', price: '', stock: '0', categoryId: '', tag: '', imageUrl: '' })
    setProductEditorOpen(true)
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault()
    setDbError('')
    const stock = Number(productForm.stock)
    if (!Number.isInteger(stock) || stock < 0) {
      setDbError('El stock debe ser un número entero igual o mayor que cero.')
      return
    }
    if (productImageFile && !['image/jpeg', 'image/png', 'image/webp'].includes(productImageFile.type)) {
      setDbError('La imagen debe ser JPG, PNG o WebP.')
      return
    }
    if (productImageFile && productImageFile.size > 5 * 1024 * 1024) {
      setDbError('La imagen no puede superar los 5 MB.')
      return
    }
    const payload: Record<string, string | number> = {
      nombre: productForm.name.trim(),
      precio_base: Number(productForm.price) * PRICE_STORAGE_SCALE,
      stock,
      etiqueta: productForm.tag.trim(),
    }
    if (!editingProduct) {
      payload.slug = `${createSlug(productForm.name)}-${crypto.randomUUID().slice(0, 8)}`
      payload.genero = 'unisex'
    }
    let uploadedImagePath = ''
    if (productImageFile) {
      const extension = productImageFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      uploadedImagePath = `${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('productos').upload(uploadedImagePath, productImageFile, {
        cacheControl: '3600',
        contentType: productImageFile.type,
        upsert: false,
      })
      if (error) {
        setDbError(`No se pudo subir la imagen: ${error.message}. Verifica que ejecutaste la configuración de Storage en Supabase.`)
        return
      }
      payload.imagen_url = supabase.storage.from('productos').getPublicUrl(uploadedImagePath).data.publicUrl
    } else if (productForm.imageUrl.trim()) {
      payload.imagen_url = productForm.imageUrl.trim()
    }
    let categoryId = productForm.categoryId
    if (categoryId.startsWith('new:')) {
      const categoryName = categoryId.slice(4)
      const categorySlug = categoryName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const { data: existingCategory, error: lookupError } = await supabase
        .from('categorias')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle()
      if (lookupError) {
        if (uploadedImagePath) await supabase.storage.from('productos').remove([uploadedImagePath])
        setDbError(`No se pudo buscar la categoría: ${lookupError.message}`)
        return
      }

      if (existingCategory) {
        categoryId = String(existingCategory.id)
      } else {
        const { data: category, error: insertError } = await supabase
          .from('categorias')
          .insert({
            nombre: categoryName,
            slug: categorySlug,
            tipo_ranura: CATEGORY_SLOT_TYPES[categoryName],
          })
          .select('id')
          .single()

        if (insertError?.code === '23505') {
          const { data: duplicateCategory, error: duplicateLookupError } = await supabase
            .from('categorias')
            .select('id')
            .eq('slug', categorySlug)
            .maybeSingle()
          if (!duplicateLookupError && duplicateCategory) {
            categoryId = String(duplicateCategory.id)
          } else {
            if (uploadedImagePath) await supabase.storage.from('productos').remove([uploadedImagePath])
            setDbError(`La categoría ya existe, pero no se pudo recuperar: ${duplicateLookupError?.message ?? insertError.message}`)
            return
          }
        } else if (insertError || !category) {
          if (uploadedImagePath) await supabase.storage.from('productos').remove([uploadedImagePath])
          setDbError(`No se pudo crear la categoría: ${insertError?.message ?? 'Respuesta vacía de Supabase.'}`)
          return
        } else {
          categoryId = String(category.id)
        }
      }
    }
    if (categoryId) payload.categoria_id = categoryId

    let result = editingProduct
      ? await supabase.from('productos').update(payload).eq('id', editingProduct.id).select('id').maybeSingle()
      : await supabase.from('productos').insert(payload)

    let imageWasSkipped = false
    const missingImageColumn = result.error?.message.includes('imagen_url')
      && (result.error.code === '42703' || result.error.code === 'PGRST204')
    if (missingImageColumn && payload.imagen_url) {
      if (productImageFile) {
        await supabase.storage.from('productos').remove([uploadedImagePath])
        await loadData()
        if (categoryId) setProductForm(form => ({ ...form, categoryId }))
        setDbError('La base no tiene la columna imagen_url. Ejecuta la actualización SQL de productos y vuelve a guardar la imagen.')
        return
      }
      delete payload.imagen_url
      result = editingProduct
        ? await supabase.from('productos').update(payload).eq('id', editingProduct.id).select('id').maybeSingle()
        : await supabase.from('productos').insert(payload)
      imageWasSkipped = !result.error
    }

    if (result.error) {
      if (uploadedImagePath) await supabase.storage.from('productos').remove([uploadedImagePath])
      setDbError(`No se pudo guardar el producto: ${result.error.message}`)
      return
    }
    if (editingProduct && !result.data) {
      setDbError('Supabase no actualizó el producto. Verifica que tu cuenta tenga rol admin y que el producto siga registrado; no se guardaron los cambios.')
      return
    }

    setProductEditorOpen(false)
    await loadData()
    await onProductsChanged()
    if (imageWasSkipped) setDbError('Producto guardado. Para guardar su imagen, ejecuta la actualización SQL de Supabase.')
  }

  async function deleteProduct(product: any) {
    if (!window.confirm(`¿Eliminar ${product.nombre}?`)) return
    const { error } = await supabase.from('productos').delete().eq('id', product.id)
    if (error) {
      setDbError(`No se pudo eliminar el producto: ${error.message}`)
      return
    }
    await loadData()
    await onProductsChanged()
  }

  async function updateOrderItemStatus(itemId: string, status: string) {
    const { error } = await supabase.rpc('actualizar_estado_articulo', {
      p_articulo_id: itemId,
      p_estado: status,
    })
    if (error) {
      setDbError(`No se pudo actualizar el estado del producto: ${error.message}`)
      return
    }
    await loadData()
  }

  async function updateReturnStatus(returnId: string, status: 'aprobado' | 'rechazado') {
    setDbError('')
    const { error } = await supabase.rpc('gestionar_devolucion', {
      p_devolucion_id: returnId,
      p_estado: status,
    })
    if (error) {
      setDbError(`No se pudo actualizar la devolución: ${error.message}`)
      return
    }
    await Promise.all([loadData(), onProductsChanged()])
  }

  function exportOrders() {
    const rows = [
      ['Pedido', 'Código del artículo', 'Producto', 'Talla', 'Fecha', 'Cliente', 'Total', 'Estado del artículo'],
      ...orderProductRows.map(row => [
        row.order,
        row.item?.codigo_producto ?? '',
        row.item?.nombre_producto ?? '',
        row.item?.talla ?? '',
        row.date,
        row.customer,
        row.total,
        row.item?.estado ?? '',
      ]),
    ]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'pedidos-velour.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setDbError(`No se pudo cerrar la sesión: ${error.message}`)
      return
    }
    localStorage.removeItem(SESSION_STORAGE_KEY)
    window.dispatchEvent(new Event('velour-session-change'))
    setPage('login')
  }

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '▣' },
    { key: 'orders', label: 'Pedidos', icon: '◫' },
    { key: 'products', label: 'Productos', icon: '◧' },
    { key: 'clients', label: 'Clientes', icon: '◉' },
    { key: 'returns', label: 'Devoluciones', icon: '↺' },
  ]

  const totalIngresos = dbOrders.reduce((sum, order) => sum + Number(order.monto_total) / PRICE_STORAGE_SCALE, 0)
  const stats = [
    { label: 'Ingresos totales', value: formatPrice(totalIngresos), delta: 'N/A', tone: 'amber' },
    { label: 'Pedidos totales', value: dbOrders.length.toString(), delta: 'N/A', tone: 'slate' },
    { label: 'Devoluciones', value: dbReturns.length.toString(), delta: 'N/A', tone: 'rose' },
  ]

  const orderProductRows = dbOrders.flatMap(order => {
    const items = order.pedido_productos ?? []
    const orderInfo = {
      order: order.numero_orden || order.id.substring(0, 8),
      customer: order.perfiles ? `${order.perfiles.nombre || ''} ${order.perfiles.apellido || ''}`.trim() : 'Desconocido',
      date: new Date(order.creado_el).toLocaleDateString('es-PE'),
      total: formatPrice(Number(order.monto_total) / PRICE_STORAGE_SCALE),
    }
    return items.length
      ? items.map((item: any) => ({ ...orderInfo, item }))
      : [{ ...orderInfo, item: null }]
  })

  const productRows = dbProducts.map(prod => ({
    id: prod.id,
    code: String(prod.id),
    product: prod.nombre,
    category: prod.categorias ? prod.categorias.nombre : 'Sin categoría',
    price: formatPrice(Number(prod.precio_base) / PRICE_STORAGE_SCALE),
    stock: Number(prod.stock ?? 0),
    tag: prod.etiqueta || 'Base',
    actions: 'Ver'
  }))

  const clientRows = dbClients.map(client => {
    const ordersCount = client.pedidos ? client.pedidos.length : 0;
    const totalSpent = client.pedidos ? client.pedidos.reduce((sum: number, p: any) => sum + Number(p.monto_total) / PRICE_STORAGE_SCALE, 0) : 0;
    return {
      id: client.id,
      client: `${client.nombre || ''} ${client.apellido || ''}`.trim() || 'Desconocido',
      email: client.correo,
      orders: ordersCount,
      total: formatPrice(totalSpent),
      since: new Date(client.creado_el).toLocaleDateString('es-PE'),
      actions: 'Ver'
    }
  })

  async function copyClientEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedClientEmail(true)
      window.setTimeout(() => setCopiedClientEmail(false), 2000)
    } catch (error) {
      setDbError(`No se pudo copiar el correo: ${error instanceof Error ? error.message : 'el navegador no permitió acceder al portapapeles.'}`)
    }
  }

  const returnRows: ReturnRow[] = dbReturns.map(ret => ({
    id: ret.id,
    code: ret.codigo_devolucion,
    order: ret.pedido_id ? ret.pedido_id.substring(0, 8) : '',
    client: ret.perfiles ? `${ret.perfiles.nombre || ''} ${ret.perfiles.apellido || ''}`.trim() : 'Desconocido',
    product: ret.variantes_producto?.productos?.nombre || 'Producto desconocido',
    reason: ret.motivo,
    date: new Date(ret.creado_el).toLocaleDateString('es-PE'),
    status: ret.estado ? ret.estado.charAt(0).toUpperCase() + ret.estado.slice(1) : 'Desconocido',
    action: ret.estado === 'pendiente' || ret.estado === 'en revisión' ? 'Resolver' : 'Resuelta',
    email: '',
    phone: '',
    address: '',
    details: '',
    productImage: '',
  }))

  const [selectedReturnCode, setSelectedReturnCode] = useState(returnRows[0]?.code ?? '')
  const selectedReturn = returnRows.find(row => row.code === selectedReturnCode) ?? returnRows[0] ?? {
    code: '',
    order: '',
    client: '',
    email: '',
    phone: '',
    address: '',
    product: '',
    reason: '',
    date: '',
    status: '',
    action: 'Ver',
    details: '',
    productImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&h=1000&fit=crop&auto=format'
  }

  const sales = Array.from({ length: 12 }, () => 0)
  dbOrders.forEach(order => {
    const orderDate = new Date(order.creado_el)
    if (orderDate.getFullYear() === new Date().getFullYear()) {
      sales[orderDate.getMonth()] += Number(order.monto_total) / PRICE_STORAGE_SCALE || 0
    }
  })
  const maxMonthlySales = Math.max(...sales, 1)

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Enviado':
        return 'bg-sky-100 text-sky-700'
      case 'Pagado':
        return 'bg-amber-100 text-amber-700'
      case 'Completado':
        return 'bg-emerald-100 text-emerald-700'
      case 'En preparación':
        return 'bg-amber-100 text-amber-700'
      case 'Entregado':
        return 'bg-emerald-100 text-emerald-700'
      case 'Cancelado':
        return 'bg-rose-100 text-rose-700'
      case 'Aprobado':
        return 'bg-emerald-100 text-emerald-700'
      case 'En revisión':
        return 'bg-violet-100 text-violet-700'
      case 'Pendiente':
        return 'bg-amber-100 text-amber-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const renderTableEmptyState = (message: string) => (
    <div className="py-20 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-[#F2EFE9] rounded-full flex items-center justify-center mb-4">
        <svg width="24" height="24" fill="none" stroke="#6B6860" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
      <p className="text-[#0D0D0D] font-display text-xl">{message}</p>
      <p className="text-[#6B6860] text-sm mt-2">Los datos aparecerán aquí cuando estén disponibles.</p>
    </div>
  )

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-800 uppercase tracking-[0.3em] text-[#C9A96E]">Resumen General</p>
          <h1 className="font-display text-4xl text-[#0D0D0D] mt-2">Dashboard</h1>
        </div>
          <button onClick={exportOrders} className="bg-gradient-to-r from-[#0D0D0D] to-[#2a2a2a] text-[#C9A96E] px-6 py-3 text-[10px] font-800 uppercase tracking-widest rounded-full shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-105 transition-all duration-300">
          Exportar Datos
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat, i) => (
          <div key={stat.label} className="group relative bg-white/70 backdrop-blur-2xl border border-white p-7 rounded-3xl shadow-xl shadow-black/5 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-[#C9A96E]/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <span className="text-xs font-700 text-[#6B6860] uppercase tracking-widest">{stat.label}</span>
              <span className={`px-3 py-1.5 text-[10px] font-800 rounded-full shadow-sm ${stat.tone === 'amber' ? 'bg-amber-100 text-amber-800' : stat.tone === 'slate' ? 'bg-slate-200 text-slate-800' : 'bg-rose-100 text-rose-800'}`}>
                {stat.delta}
              </span>
            </div>
              <div className="text-5xl font-display text-[#0D0D0D] relative z-10 tracking-tight">{isLoading ? '...' : stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-2xl border border-white p-8 rounded-3xl shadow-xl shadow-black/5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div>
            <p className="text-[10px] font-800 uppercase tracking-[0.3em] text-[#6B6860]">Rendimiento Anual</p>
            <h2 className="font-display text-3xl text-[#0D0D0D] mt-2">Ventas Mensuales</h2>
          </div>
          <span className="px-5 py-2 bg-[#0D0D0D] text-[#C9A96E] text-xs font-700 rounded-full shadow-lg">{new Date().getFullYear()}</span>
        </div>

        <div className="flex items-end justify-between h-72 gap-2 sm:gap-4 relative z-10">
          {sales.map((value, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-4">
              <div className="w-full flex items-end justify-center h-56 relative group/bar">
                <div
                  className="w-full max-w-[48px] rounded-t-2xl bg-gradient-to-t from-[#0D0D0D] to-[#3a3a3a] shadow-lg transition-all duration-500 group-hover/bar:from-[#C9A96E] group-hover/bar:to-[#F3D79F] group-hover/bar:scale-y-105 origin-bottom relative overflow-hidden"
                  style={{ height: `${value === 0 ? 4 : Math.max(8, value / maxMonthlySales * 100)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-700 ease-out"></div>
                </div>
              </div>
              <span className="text-[10px] font-800 text-[#6B6860] uppercase group-hover/bar:text-[#0D0D0D] transition-colors">{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderOrders = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-600 uppercase tracking-[0.2em] text-[#C9A96E]">Operaciones</p>
          <h1 className="font-display text-3xl text-[#0D0D0D] mt-2">Pedidos recientes</h1>
        </div>
        <button onClick={() => void loadData()} className="border border-[#DDD9D0] px-4 py-2 text-xs font-600 uppercase tracking-wide text-[#0D0D0D] hover:border-[#0D0D0D] transition-colors">
          Actualizar
        </button>
      </div>

      <div className="bg-white border border-[#E6E1D8] overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-[#F5F1ED] text-[#6B6860] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-600">Orden</th>
              <th className="px-4 py-3 font-600">Código del artículo</th>
              <th className="px-4 py-3 font-600">Producto</th>
              <th className="px-4 py-3 font-600">Cliente</th>
              <th className="px-4 py-3 font-600">Fecha</th>
              <th className="px-4 py-3 font-600">Total</th>
              <th className="px-4 py-3 font-600">Estado del artículo</th>
              <th className="px-4 py-3 font-600">Actualizar estado</th>
            </tr>
          </thead>
          <tbody>
            {orderProductRows.map((row, index) => {
              const item = row.item
              const itemStatus = item?.estado ?? ''
              const displayStatus = itemStatus ? itemStatus.charAt(0).toUpperCase() + itemStatus.slice(1) : 'Sin artículos'
              return (
                <tr key={item?.id ?? `${row.order}-${index}`} className="border-t border-[#EEE8E1] text-sm text-[#0D0D0D]">
                  <td className="px-4 py-3 font-600">{row.order}</td>
                  <td className="px-4 py-3">
                    {item ? <span className="font-mono text-xs">{item.codigo_producto}</span> : <span className="text-[#6B6860]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item ? <>{item.nombre_producto}<span className="block text-xs text-[#6B6860]">Talla {item.talla}</span></> : <span className="text-[#6B6860]">Pedido antiguo sin detalle de artículos</span>}
                  </td>
                  <td className="px-4 py-3">{row.customer}</td>
                  <td className="px-4 py-3 text-[#6B6860]">{row.date}</td>
                  <td className="px-4 py-3 font-600">{row.total}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-700 rounded-full ${getStatusClasses(displayStatus)}`}>{displayStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Estado de ${item?.nombre_producto ?? `pedido ${row.order}`}${item ? `, código ${item.codigo_producto}` : ''}`}
                      value={itemStatus}
                      disabled={!item}
                      onChange={event => item && void updateOrderItemStatus(item.id, event.target.value)}
                      className="border border-[#DDD9D0] bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-[#F5F1ED]"
                    >
                      {item ? ['pendiente', 'en preparación', 'enviado', 'entregado', 'cancelado'].map(status => <option key={status} value={status}>{status}</option>) : <option value="">Sin artículos</option>}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderProducts = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-600 uppercase tracking-[0.2em] text-[#C9A96E]">Catálogo</p>
          <h1 className="font-display text-3xl text-[#0D0D0D] mt-2">Productos</h1>
        </div>
        <button onClick={() => openProductEditor()} className="bg-[#0D0D0D] text-white px-4 py-2 text-xs font-600 uppercase tracking-wide hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
          Añadir producto
        </button>
      </div>

      <div className="bg-white border border-[#E6E1D8] overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-[#F5F1ED] text-[#6B6860] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-600">Producto</th>
              <th className="px-4 py-3 font-600">Código</th>
              <th className="px-4 py-3 font-600">Categoría</th>
              <th className="px-4 py-3 font-600">Precio</th>
              <th className="px-4 py-3 font-600">Stock</th>
              <th className="px-4 py-3 font-600">Etiqueta</th>
              <th className="px-4 py-3 font-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productRows.map(row => (
              <tr key={row.id} className="border-t border-[#EEE8E1] text-sm text-[#0D0D0D]">
                <td className="px-4 py-3 font-600">{row.product}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3">{row.price}</td>
                <td className="px-4 py-3">{row.stock}</td>
                <td className="px-4 py-3"><span className="inline-flex px-2.5 py-1 text-[10px] font-700 rounded-full bg-[#F2EFE9] text-[#0D0D0D]">{row.tag}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openProductEditor(dbProducts.find(product => product.id === row.id))} className="text-xs font-600 text-[#0D0D0D] hover:text-[#C9A96E]">Editar</button>
                    <button onClick={() => setMeasurementProduct(dbProducts.find(product => product.id === row.id))} className="text-xs font-600 text-[#0D0D0D] hover:text-[#C9A96E]">Tallas y medidas</button>
                    <button onClick={() => void deleteProduct(dbProducts.find(product => product.id === row.id))} className="text-xs font-600 text-red-700 hover:text-red-900">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productRows.length === 0 && renderTableEmptyState(isLoading ? 'Cargando productos…' : 'No hay productos registrados')}
      </div>
    </div>
  )

  const renderClients = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-600 uppercase tracking-[0.2em] text-[#C9A96E]">CRM</p>
          <h1 className="font-display text-3xl text-[#0D0D0D] mt-2">Clientes</h1>
        </div>
        <button className="border border-[#DDD9D0] px-4 py-2 text-xs font-600 uppercase tracking-wide text-[#0D0D0D] hover:border-[#0D0D0D] transition-colors">
          Exportar</button>
      </div>

      <div className="bg-white border border-[#E6E1D8] overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-[#F5F1ED] text-[#6B6860] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-600">Cliente</th>
              <th className="px-4 py-3 font-600">Email</th>
              <th className="px-4 py-3 font-600">Pedidos</th>
              <th className="px-4 py-3 font-600">Total gastado</th>
              <th className="px-4 py-3 font-600">Miembro desde</th>
              <th className="px-4 py-3 font-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientRows.map(row => (
              <tr key={row.email} className="border-t border-[#EEE8E1] text-sm text-[#0D0D0D]">
                <td className="px-4 py-3 font-600">{row.client}</td>
                <td className="px-4 py-3 text-[#6B6860]">{row.email}</td>
                <td className="px-4 py-3">{row.orders}</td>
                <td className="px-4 py-3">{row.total}</td>
                <td className="px-4 py-3">{row.since}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setSelectedClient(dbClients.find(client => client.id === row.id) ?? null); setCopiedClientEmail(false) }}
                    className="text-xs font-600 text-[#0D0D0D] hover:text-[#C9A96E]"
                  >
                    {row.actions}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderReturns = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-600 uppercase tracking-[0.2em] text-[#C9A96E]">Servicio</p>
          <h1 className="font-display text-3xl text-[#0D0D0D] mt-2">Devoluciones</h1>
        </div>
        <button className="bg-[#0D0D0D] text-white px-4 py-2 text-xs font-600 uppercase tracking-wide hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
          Nueva solicitud
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
            { label: 'Total solicitudes', value: dbReturns.length, detail: 'Registradas en el sistema' },
            { label: 'Pendientes', value: dbReturns.filter(item => item.estado === 'pendiente' || item.estado === 'en revisión').length, detail: 'Requieren revisión' },
            { label: 'Aprobadas', value: dbReturns.filter(item => item.estado === 'aprobado').length, detail: 'Stock repuesto al aprobar' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-[#E6E1D8] p-5 shadow-sm">
            <p className="text-sm text-[#6B6860]">{stat.label}</p>
            <div className="text-3xl font-display text-[#0D0D0D] mt-2">{stat.value}</div>
            <p className="text-xs text-[#6B6860] mt-2">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E6E1D8] overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-[#F5F1ED] text-[#6B6860] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-600">Código devolución</th>
              <th className="px-4 py-3 font-600">Orden</th>
              <th className="px-4 py-3 font-600">Cliente</th>
              <th className="px-4 py-3 font-600">Producto</th>
              <th className="px-4 py-3 font-600">Motivo</th>
              <th className="px-4 py-3 font-600">Fecha</th>
              <th className="px-4 py-3 font-600">Estado</th>
              <th className="px-4 py-3 font-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {returnRows.map(row => (
              <tr key={row.code} className={`border-t border-[#EEE8E1] text-sm text-[#0D0D0D] align-top ${selectedReturnCode === row.code ? 'bg-[#FAF8F5]' : ''}`}>
                <td className="px-4 py-3 font-600">{row.code}</td>
                <td className="px-4 py-3">{row.order}</td>
                <td className="px-4 py-3">{row.client}</td>
                <td className="px-4 py-3">{row.product}</td>
                <td className="px-4 py-3 text-[#6B6860]">{row.reason}</td>
                <td className="px-4 py-3 text-[#6B6860]">{row.date}</td>
                <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 text-[10px] font-700 rounded-full ${getStatusClasses(row.status)}`}>{row.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setSelectedReturnCode(row.code)} className="text-xs font-600 text-[#0D0D0D] hover:text-[#C9A96E] text-left">
                      Ver detalles
                    </button>
                    {row.id && (row.status === 'Pendiente' || row.status === 'En revisión') && (
                      <>
                        <button onClick={() => void updateReturnStatus(row.id!, 'aprobado')} className="text-xs font-600 text-emerald-700 hover:text-emerald-900 text-left">Aprobar y reponer stock</button>
                        <button onClick={() => void updateReturnStatus(row.id!, 'rechazado')} className="text-xs font-600 text-red-700 hover:text-red-900 text-left">Rechazar</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {returnRows.length === 0 && renderTableEmptyState(isLoading ? 'Cargando devoluciones…' : 'No hay devoluciones registradas')}
      </div>

      <div className="bg-[#FAF8F5] border border-[#E6E1D8] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-600 uppercase tracking-[0.2em] text-[#C9A96E]">Detalle</p>
            <h2 className="font-display text-2xl text-[#0D0D0D] mt-1">Solicitud {selectedReturn.code}</h2>
          </div>
          <span className={`inline-flex px-2.5 py-1 text-[10px] font-700 rounded-full ${getStatusClasses(selectedReturn.status)}`}>{selectedReturn.status}</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 text-sm text-[#0D0D0D]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Cliente</p>
                <p className="font-600">{selectedReturn.client}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Orden</p>
                <p className="font-600">{selectedReturn.order}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Correo</p>
                <p>{selectedReturn.email ?? ''}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Teléfono</p>
                <p>{selectedReturn.phone ?? ''}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Dirección</p>
              <p>{selectedReturn.address ?? ''}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Producto</p>
              <p className="font-600">{selectedReturn.product}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Motivo de devolución</p>
              <p className="font-600">{selectedReturn.reason}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-1">Información del cliente</p>
              <p className="text-[#6B6860] leading-relaxed">{selectedReturn.details ?? ''}</p>
            </div>
          </div>

          <div className="rounded-lg border border-[#DDD9D0] bg-white p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6860] mb-2">Imagen adjunta</p>
            <img
              src={selectedReturn.productImage ?? 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&h=1000&fit=crop&auto=format'}
              alt={`Producto de la devolución ${selectedReturn.product}`}
              className="w-full h-72 object-cover rounded-md border border-[#E6E1D8]"
            />
            <p className="text-xs text-[#6B6860] mt-3">Evidencia enviada por el cliente con su información y la foto del producto.</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex font-sans selection:bg-[#C9A96E]/30 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-[#C9A96E]/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none"></div>
      
      <aside className="w-72 bg-[#080808] text-white flex-shrink-0 flex flex-col justify-between border-r border-[#1a1a1a] relative z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a]/50 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="p-8 border-b border-white/10">
            <div className="font-display text-3xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-[#C9A96E]">VELOUR</div>
            <p className="text-[10px] font-800 uppercase tracking-[0.3em] text-[#C9A96E] mt-2">Administración</p>
          </div>

          <nav className="p-6 space-y-3">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-2xl transition-all duration-300 ${activeTab === tab.key ? 'bg-gradient-to-r from-[#C9A96E] to-[#E5C687] text-[#0D0D0D] shadow-lg shadow-[#C9A96E]/20 scale-105' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-xs font-700 uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 border-t border-white/10 space-y-3 relative z-10">
          <button
            type="button"
            onClick={() => setPage('home')}
            className="w-full text-left px-4 py-3 text-xs font-700 uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            ← Volver a tienda
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-xs font-700 uppercase tracking-widest text-red-400/80 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 h-screen overflow-y-auto relative z-10 scrollbar-hide">
        <header className="mb-8 flex flex-col gap-4 border border-[#E6E1D8] bg-white/80 px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-800 uppercase tracking-[0.25em] text-[#C9A96E]">Panel de administración</p>
            <p className="mt-1 text-sm font-600 text-[#0D0D0D]">Bienvenido, {session?.email || 'Administrador'}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-700 uppercase tracking-[0.2em] text-[#6B6860]">Fecha de hoy</p>
            <p className="mt-1 text-sm font-600 capitalize text-[#0D0D0D]">
              {new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(new Date())}
            </p>
          </div>
        </header>
        {dbError && <div role="alert" className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{dbError}</div>}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'products' && renderProducts()}
        {activeTab === 'clients' && renderClients()}
        {activeTab === 'returns' && renderReturns()}
      </main>

      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) setSelectedClient(null) }}
        >
          <section
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-detail-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#EEE8E1] pb-5">
              <div>
                <p className="text-xs font-700 uppercase tracking-[0.2em] text-[#C9A96E]">Ficha del cliente</p>
                <h2 id="client-detail-title" className="mt-2 font-display text-2xl font-700 text-[#0D0D0D]">
                  {[selectedClient.nombre, selectedClient.apellido].filter(Boolean).join(' ') || 'Cliente'}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedClient(null)} aria-label="Cerrar detalle" className="px-2 text-2xl text-[#6B6860] hover:text-[#0D0D0D]">
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#EEE8E1] bg-[#FAF8F5] p-4">
                <p className="text-[10px] font-700 uppercase tracking-[0.15em] text-[#6B6860]">Correo electrónico</p>
                <p className="mt-2 break-all text-sm font-600 text-[#0D0D0D]">{selectedClient.correo || 'No registrado'}</p>
                {selectedClient.correo && (
                  <button
                    type="button"
                    onClick={() => void copyClientEmail(selectedClient.correo)}
                    className="mt-3 text-xs font-700 text-[#8A6B36] hover:underline"
                  >
                    {copiedClientEmail ? 'Correo copiado' : 'Copiar correo'}
                  </button>
                )}
              </div>
              <div className="border border-[#EEE8E1] bg-[#FAF8F5] p-4">
                <p className="text-[10px] font-700 uppercase tracking-[0.15em] text-[#6B6860]">Miembro desde</p>
                <p className="mt-2 text-sm font-600 text-[#0D0D0D]">
                  {selectedClient.creado_el ? new Date(selectedClient.creado_el).toLocaleDateString('es-PE') : 'Sin fecha'}
                </p>
              </div>
              <div className="border border-[#EEE8E1] p-4">
                <p className="text-[10px] font-700 uppercase tracking-[0.15em] text-[#6B6860]">Pedidos realizados</p>
                <p className="mt-2 font-display text-2xl font-700 text-[#0D0D0D]">{selectedClient.pedidos?.length ?? 0}</p>
              </div>
              <div className="border border-[#EEE8E1] p-4">
                <p className="text-[10px] font-700 uppercase tracking-[0.15em] text-[#6B6860]">Total gastado</p>
                <p className="mt-2 font-display text-2xl font-700 text-[#0D0D0D]">
                  {formatPrice((selectedClient.pedidos ?? []).reduce((sum: number, order: any) => sum + Number(order.monto_total) / PRICE_STORAGE_SCALE, 0))}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-display text-xl font-700 text-[#0D0D0D]">Historial de pedidos</h3>
              {selectedClient.pedidos?.length ? (
                <div className="mt-4 space-y-4">
                  {[...selectedClient.pedidos]
                    .sort((a: any, b: any) => new Date(b.creado_el).getTime() - new Date(a.creado_el).getTime())
                    .map((order: any) => (
                      <article key={order.id} className="border border-[#E6E1D8] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-700 text-[#0D0D0D]">Orden {order.numero_orden || order.id?.slice(0, 8) || '—'}</p>
                            <p className="mt-1 text-xs text-[#6B6860]">
                              {order.creado_el ? new Date(order.creado_el).toLocaleDateString('es-PE') : 'Fecha no disponible'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-700 text-[#0D0D0D]">{formatPrice(Number(order.monto_total) / PRICE_STORAGE_SCALE)}</p>
                            <p className="mt-1 text-xs capitalize text-[#6B6860]">Estado: {order.estado || 'No disponible'}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-[#6B6860]">
                          Código de devolución: <span className="font-mono font-700 text-[#0D0D0D]">{order.codigo_devolucion || 'No registrado'}</span>
                        </p>
                        {order.pedido_productos?.length ? (
                          <ul className="mt-3 divide-y divide-[#EEE8E1] border-t border-[#EEE8E1]">
                            {order.pedido_productos.map((item: any) => (
                              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                                <span className="text-[#0D0D0D]">
                                  {item.nombre_producto} · Talla {item.talla}
                                  <span className="ml-2 font-mono text-[#6B6860]">{item.codigo_producto}</span>
                                </span>
                                <span className="capitalize text-[#6B6860]">{item.estado}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-xs text-[#6B6860]">Este pedido no tiene detalle de artículos registrado.</p>
                        )}
                      </article>
                    ))}
                </div>
              ) : (
                <p className="mt-3 border border-dashed border-[#DDD9D0] p-5 text-sm text-[#6B6860]">Este cliente todavía no tiene pedidos.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setSelectedClient(null)} className="border border-[#DDD9D0] px-5 py-2 text-xs font-700 uppercase tracking-wide text-[#0D0D0D] hover:border-[#0D0D0D]">
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {productEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProductEditorOpen(false) }}>
          <form onSubmit={saveProduct} className="w-full max-w-lg space-y-4 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
            <div className="flex items-center justify-between">
              <h2 id="product-editor-title" className="font-display text-2xl text-[#0D0D0D]">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button type="button" onClick={() => setProductEditorOpen(false)} aria-label="Cerrar" className="px-2 py-1 text-lg">×</button>
            </div>
            <label className="block text-xs font-600 uppercase text-[#6B6860]">Nombre
              <input required value={productForm.name} onChange={event => setProductForm(form => ({ ...form, name: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-600 uppercase text-[#6B6860]">Precio (S/)
                <input required type="number" min="0" step="0.01" value={productForm.price} onChange={event => setProductForm(form => ({ ...form, price: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case" />
              </label>
              <label className="block text-xs font-600 uppercase text-[#6B6860]">Stock disponible
                <input required type="number" min="0" step="1" value={productForm.stock} onChange={event => setProductForm(form => ({ ...form, stock: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case" />
              </label>
              <label className="block text-xs font-600 uppercase text-[#6B6860]">Categoría
                <select required={!editingProduct} value={productForm.categoryId} onChange={event => setProductForm(form => ({ ...form, categoryId: event.target.value }))} className="mt-1 w-full border border-[#DDD9D0] bg-white px-3 py-2 text-sm normal-case">
                  <option value="">Seleccionar</option>
                  {dbCategories.map(category => <option key={category.id} value={category.id}>{category.nombre}</option>)}
                  {CATEGORIES.filter(category => category !== 'Todos' && !dbCategories.some(item => item.nombre.toLowerCase() === category.toLowerCase())).map(category => (
                    <option key={`new:${category}`} value={`new:${category}`}>{category} (crear categoría)</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-600 uppercase text-[#6B6860]">Etiqueta
              <input value={productForm.tag} onChange={event => setProductForm(form => ({ ...form, tag: event.target.value }))} placeholder="Nuevo" className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case" />
            </label>
            <label className="block text-xs font-600 uppercase text-[#6B6860]">Subir imagen desde tu equipo
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProductImageFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case file:mr-3 file:border-0 file:bg-[#F2EFE9] file:px-3 file:py-1.5" />
            </label>
            <label className="block text-xs font-600 uppercase text-[#6B6860]">O usa una URL de imagen
              <input type="url" value={productForm.imageUrl} onChange={event => setProductForm(form => ({ ...form, imageUrl: event.target.value }))} placeholder="https://..." className="mt-1 w-full border border-[#DDD9D0] px-3 py-2 text-sm normal-case" />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setProductEditorOpen(false)} className="border border-[#DDD9D0] px-4 py-2 text-xs font-600 uppercase">Cancelar</button>
              <button type="submit" className="bg-[#0D0D0D] px-4 py-2 text-xs font-600 uppercase text-white hover:bg-[#C9A96E] hover:text-[#0D0D0D]">Guardar producto</button>
            </div>
          </form>
        </div>
      )}
      {measurementProduct && <GarmentMeasurementEditor product={measurementProduct} onClose={() => setMeasurementProduct(null)} />}
    </div>
  )
}

// ─── Forgot Password Page ───────────────────────────────────────────────────

function ForgotPasswordPage({ setPage }: { setPage: (p: Page) => void }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const pageRef = useGsapEntrance([])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email.trim())) return
    setSubmitted(true)
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0D0D0D] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&h=1000&fit=crop&auto=format"
          alt="Moda VELOUR"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D]/65 to-transparent" />
        <div className="relative z-10 p-12 flex flex-col justify-end">
          <span className="font-display text-white text-3xl font-700">VELOUR</span>
          <p className="text-white/60 text-sm mt-2">Recupera tu acceso a tu cuenta</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Seguridad</p>
            <h1 className="font-display text-3xl font-700 text-[#0D0D0D]">¿Olvidaste tu contraseña?</h1>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Correo electrónico</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full px-4 py-3 border border-[#DDD9D0] text-sm text-[#0D0D0D] placeholder-[#6B6860]/50 focus:border-[#C9A96E] focus:outline-none bg-white transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors"
              >
                Enviar enlace
              </button>
            </form>
          ) : (
            <div className="border border-[#DDD9D0] bg-white p-6">
              <p className="text-sm text-[#6B6860] mb-3">Hemos enviado un enlace de recuperación a:</p>
              <p className="font-600 text-[#0D0D0D] break-all">{email}</p>
              <p className="mt-5 text-sm text-[#6B6860] leading-relaxed">
                Revisa tu correo y sigue las instrucciones para restablecer tu contraseña.
              </p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-[#DDD9D0] text-center">
            <button onClick={() => setPage('login')} className="text-[#0D0D0D] font-600 hover:text-[#C9A96E] transition-colors">
              ← Volver a iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [session, setSession] = useState<SessionInfo | null>(() => getSessionInfo())
  const [pendingPage, setPendingPage] = useState<Page | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>(PRODUCTS)

  useEffect(() => {
    function syncAuthSession(authSession: Session | null) {
      if (!authSession) {
        localStorage.removeItem(SESSION_STORAGE_KEY)
        sessionStorage.removeItem(BODY_STORAGE_KEY)
        setSession(null)
        return
      }

      const email = authSession.user.email ?? ''
      const storedSession = getSessionInfo()
      if (storedSession?.email.toLowerCase() === email.toLowerCase()) {
        setSession(storedSession)
      } else {
        sessionStorage.removeItem(BODY_STORAGE_KEY)
        const nextSession: SessionInfo = { email, role: 'client' }
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession))
        setSession(nextSession)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      syncAuthSession(authSession)
    })
    const handleStoredSessionChange = () => setSession(getSessionInfo())
    window.addEventListener('velour-session-change', handleStoredSessionChange)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('velour-session-change', handleStoredSessionChange)
    }
  }, [])

  const navigatePage = useCallback((nextPage: Page) => {
    const protectedPage = nextPage === 'avatar' || nextPage === 'tryon' || nextPage === 'checkout'
    if (protectedPage && !session && !getSessionInfo()) {
      setPendingPage(nextPage)
      setPage('login')
      return
    }
    setPage(nextPage)
  }, [session])

  const clearPendingPage = useCallback(() => setPendingPage(null), [])

  const loadProducts = useCallback(async () => {
    const { data, error } = await fetchProductsFromSupabase()

    if (error) {
      console.error('Error cargando productos:', error)
      return
    }

    setProducts((data ?? []).map((product: any, index: number) => ({
      id: product.id,
      name: product.nombre,
      category: product.categorias?.nombre ?? 'Sin categoría',
      price: Number(product.precio_base) / PRICE_STORAGE_SCALE,
      stock: Number(product.stock ?? 0),
      img: product.imagen_url || PRODUCTS[index % PRODUCTS.length].img,
      tag: product.etiqueta || undefined,
    })))
  }, [])

  useEffect(() => { void loadProducts() }, [loadProducts])

  const addToCart = useCallback((product: Product, size: string) => {
    const quantityInCart = cart
      .filter(item => item.id === product.id)
      .reduce((total, item) => total + item.qty, 0)
    if (quantityInCart >= (product.stock ?? 0)) return false

    setCart(c => {
      const existing = c.find(i => i.id === product.id && i.size === size)
      const currentQuantity = c
        .filter(item => item.id === product.id)
        .reduce((total, item) => total + item.qty, 0)
      if (currentQuantity >= (product.stock ?? 0)) return c
      if (existing) return c.map(i => i.id === product.id && i.size === size ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { ...product, qty: 1, size }]
    })
    return true
  }, [cart])

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  async function handleCheckoutSuccess() {
    setCart([])
    setPage('home')
    await loadProducts()
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
    setPage('home')
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const hideNav = page === 'checkout' || page === 'admin'

  return (
    <>
      {!hideNav && <Navbar page={page} setPage={navigatePage} cartCount={cartCount} session={session} />}

      <main>
        {page === 'home' && <HomePage setPage={navigatePage} products={products} />}
        {page === 'products' && <ProductsPage setPage={navigatePage} addToCart={addToCart} products={products} />}
        {page === 'cart' && <CartPage cart={cart} setCart={setCart} setPage={navigatePage} onCheckout={() => navigatePage('checkout')} />}
        {page === 'login' && <LoginPage setPage={setPage} returnPage={pendingPage} onAuthenticated={clearPendingPage} />}
        {page === 'register' && <RegisterPage setPage={setPage} returnPage={pendingPage} onAuthenticated={clearPendingPage} />}
        {page === 'account' && <AccountPage session={session} setPage={navigatePage} onLogout={handleLogout} />}
        {page === 'forgot-password' && <ForgotPasswordPage setPage={setPage} />}
        {(page === 'avatar' || page === 'tryon') && <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] pt-28 text-center text-[#6B6860]">Cargando probador 3D…</div>}>
          <FittingExperience mode={page === 'avatar' ? 'profile' : 'tryon'} products={products} setPage={navigatePage} />
        </Suspense>}
        {page === 'checkout' && <CheckoutPage cart={cart} onSuccess={handleCheckoutSuccess} setPage={navigatePage} />}
        {page === 'admin' && <AdminDashboardPage setPage={navigatePage} onProductsChanged={loadProducts} session={session} />}
      </main>

      <WhatsAppFAB />
    </>
  )
}
