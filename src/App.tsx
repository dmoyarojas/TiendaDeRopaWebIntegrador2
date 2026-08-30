import { useState, useEffect, useRef, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─── Types ──────────────────────────────────────────────────────────────────

type Page = 'home' | 'products' | 'cart' | 'login' | 'register' | 'avatar' | 'tryon' | 'checkout'

interface Product {
  id: number
  name: string
  category: string
  price: number
  img: string
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

const USERS_STORAGE_KEY = 'velour-users'
const SESSION_STORAGE_KEY = 'velour-session'
const ADMIN_INVITATION_CODE = 'VELOUR-ADMIN'

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
  { id: 1, name: 'Blazer Estructurado', category: 'Blazers', price: 189000, img: 'https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?w=600&h=750&fit=crop&auto=format', tag: 'Nuevo' },
  { id: 2, name: 'Gabardina Clásica', category: 'Abrigos', price: 245000, img: 'https://images.unsplash.com/photo-1601762603339-fd61e28b698a?w=600&h=750&fit=crop&auto=format', tag: 'Destacado' },
  { id: 3, name: 'Vestido Minimalista', category: 'Vestidos', price: 134000, img: 'https://images.unsplash.com/photo-1659522761084-79196b64abe4?w=600&h=750&fit=crop&auto=format' },
  { id: 4, name: 'Conjunto Neutro', category: 'Conjuntos', price: 210000, img: 'https://images.unsplash.com/photo-1614028609503-590a6a47146a?w=600&h=750&fit=crop&auto=format', tag: 'Top ventas' },
  { id: 5, name: 'Camisa Lino Premium', category: 'Camisas', price: 98000, img: 'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=600&h=750&fit=crop&auto=format' },
  { id: 6, name: 'Pantalón Wide Leg', category: 'Pantalones', price: 142000, img: 'https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7?w=600&h=750&fit=crop&auto=format', tag: 'Nuevo' },
  { id: 7, name: 'Vestido Fluido', category: 'Vestidos', price: 156000, img: 'https://images.unsplash.com/photo-1549570652-97324981a6fd?w=600&h=750&fit=crop&auto=format' },
  { id: 8, name: 'Chaqueta Oversized', category: 'Blazers', price: 178000, img: 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=600&h=750&fit=crop&auto=format' },
]

const CATEGORIES = ['Todos', 'Blazers', 'Abrigos', 'Vestidos', 'Conjuntos', 'Camisas', 'Pantalones']

const SIZES = ['XS', 'S', 'M', 'L', 'XL']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return `$${n.toLocaleString('es-CO')} COP`
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

function Navbar({ page, setPage, cartCount }: { page: Page; setPage: (p: Page) => void; cartCount: number }) {
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
            onClick={() => setPage('login')}
            className="hidden md:flex items-center gap-1.5 text-sm font-500 text-[#6B6860] hover:text-[#0D0D0D] transition-colors"
            aria-label="Iniciar sesión"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span>Cuenta</span>
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
            onClick={() => { setPage('login'); setMenuOpen(false) }}
            className="text-left text-sm font-500 py-2 text-[#6B6860]"
          >
            Iniciar sesión
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
      href="https://wa.me/573001234567?text=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20sus%20productos"
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
  const items = ['NUEVA COLECCIÓN 2025', 'ENVÍO GRATIS +$200K', 'AVATAR VIRTUAL', 'MODA SOSTENIBLE', 'PRUEBA VIRTUAL', 'DISEÑO EXCLUSIVO']
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

function HomePage({ setPage }: { setPage: (p: Page) => void }) {
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

  const featured = PRODUCTS.slice(0, 4)

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
  onAddToCart?: (p: Product, size: string) => void
  onTryOn?: () => void
  compact?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [selectedSize, setSelectedSize] = useState('M')
  const [added, setAdded] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

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
      onAddToCart(product, selectedSize)
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
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
                className={`flex-1 py-2.5 text-xs font-600 tracking-wide uppercase transition-colors ${added ? 'bg-[#C9A96E] text-[#0D0D0D]' : 'bg-white text-[#0D0D0D] hover:bg-[#C9A96E]'}`}
              >
                {added ? '✓ Agregado' : 'Agregar'}
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

function ProductsPage({ setPage, addToCart }: { setPage: (p: Page) => void; addToCart: (p: Product, size: string) => void }) {
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const pageRef = useGsapEntrance([])

  const filtered = PRODUCTS.filter(p => {
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
            {CATEGORIES.map(c => (
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

  function remove(id: number, size: string) {
    setCart(c => c.filter(i => !(i.id === id && i.size === size)))
  }

  function updateQty(id: number, size: string, delta: number) {
    setCart(c => c.map(i => {
      if (i.id === id && i.size === size) {
        const qty = Math.max(1, i.qty + delta)
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
                        <button onClick={() => updateQty(item.id, item.size, 1)} className="w-7 h-7 flex items-center justify-center text-[#6B6860] hover:text-[#0D0D0D] hover:bg-[#F2EFE9] transition-colors" aria-label="Aumentar cantidad">+</button>
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
                  <span className="text-[#C9A96E]">{total >= 200000 ? 'Gratis' : formatPrice(15000)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-600">
                  <span>Total</span>
                  <span>{formatPrice(total + (total >= 200000 ? 0 : 15000))}</span>
                </div>
              </div>
              {total >= 200000 && (
                <p className="text-[#C9A96E] text-xs mb-4 text-center">◆ Envío gratis aplicado</p>
              )}
              <button onClick={onCheckout} className="w-full bg-[#C9A96E] text-[#0D0D0D] py-3.5 text-sm font-700 tracking-wide uppercase hover:bg-[#b8955c] transition-colors mb-3">
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

function LoginPage({ setPage }: { setPage: (p: Page) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pageRef = useGsapEntrance([])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!isValidEmail(email.trim())) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    const user = getStoredUsers().find(item => item.email === email.trim().toLowerCase() && item.role === role)
    if (!user || user.password !== password) {
      setError(`No existe una cuenta de ${role === 'admin' ? 'administrador' : 'cliente'} con esas credenciales.`)
      return
    }
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: user.email, role: user.role }))
      setLoading(false)
      setPage(user.role === 'admin' ? 'home' : 'avatar')
    }, 500)
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
              <a href="#" className="text-[#C9A96E] hover:underline">¿Olvidaste tu contraseña?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
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

// ─── Register Page ────────────────────────────────────────────────────────────

function RegisterPage({ setPage }: { setPage: (p: Page) => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'client' as UserRole, adminCode: '' })
  const [measurements, setMeasurements] = useState<UserMeasurements>({ gender: 'F', height: '', weight: '', chest: '', waist: '', hips: '', shoulder: '', inseam: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pageRef = useGsapEntrance([])
  const formRef = useRef<HTMLFormElement>(null)

  function update(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function updateMeasurement(k: keyof UserMeasurements, v: string) { setMeasurements(m => ({ ...m, [k]: v })) }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) return setError('Ingresa tu nombre completo.')
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
    setStep(3)
  }

  function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const invalidMeasurement = validateMeasurements(measurements)
    if (invalidMeasurement) return setError('Revisa las medidas: deben estar dentro de un rango válido y en las unidades indicadas.')
    const email = form.email.trim().toLowerCase()
    if (getStoredUsers().some(user => user.email === email)) return setError('Ya existe una cuenta con ese correo electrónico.')
    setLoading(true)
    const newUser: StoredUser = { ...form, email, name: form.name.trim(), measurements }
    setTimeout(() => {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...getStoredUsers(), newUser]))
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email, role: form.role }))
      setLoading(false)
      setPage(form.role === 'admin' ? 'home' : 'avatar')
    }, 500)
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
              <div>
                <label htmlFor="reg-name" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Nombre completo</label>
                <input id="reg-name" type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ana García" required autoComplete="name"
                  className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
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
              <p className="text-xs text-[#6B6860]">
                Al crear tu cuenta aceptas nuestros <a href="#" className="text-[#C9A96E] hover:underline">Términos de uso</a> y <a href="#" className="text-[#C9A96E] hover:underline">Política de privacidad</a>.
              </p>
              <button type="submit" disabled={loading}
                className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50 mt-2">
                Continuar a medidas
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
              <button type="submit" disabled={loading} className="w-full bg-[#0D0D0D] text-white py-3.5 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors disabled:opacity-50">{loading ? 'Creando cuenta...' : 'Crear cuenta'}</button>
              <button type="button" onClick={() => setStep(2)} className="w-full text-xs text-[#6B6860] hover:text-[#0D0D0D] transition-colors py-2">← Volver</button>
            </form>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

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

// ─── Avatar Creator ───────────────────────────────────────────────────────────

function AvatarPage({ setPage }: { setPage: (p: Page) => void }) {
  const [step, setStep] = useState<'form' | 'generating' | 'done'>('form')
  const [gender, setGender] = useState<'F' | 'M'>('F')
  const [measurements, setMeasurements] = useState<UserMeasurements>({
    gender: 'F', height: '', weight: '', chest: '', waist: '', hips: '', shoulder: '', inseam: ''
  })
  const avatarRef = useRef<SVGSVGElement>(null)
  const pageRef = useGsapEntrance([])
  const progressRef = useRef<HTMLDivElement>(null)

  function update(k: keyof UserMeasurements, v: string) {
    setMeasurements(m => ({ ...m, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStep('generating')
    // Animate progress bar
    if (progressRef.current) {
      gsap.fromTo(progressRef.current, { width: '0%' }, { width: '100%', duration: 2.5, ease: 'power1.inOut' })
    }
    setTimeout(() => setStep('done'), 2800)
  }

  useEffect(() => {
    if (step === 'done' && avatarRef.current) {
      gsap.fromTo(avatarRef.current, { opacity: 0, scale: 0.8, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.4)' })
    }
  }, [step])

  const fields: { key: keyof UserMeasurements; label: string; placeholder: string; unit: string }[] = [
    { key: 'height', label: 'Estatura', placeholder: '165', unit: 'cm' },
    { key: 'weight', label: 'Peso', placeholder: '60', unit: 'kg' },
    { key: 'chest', label: 'Contorno de pecho', placeholder: '90', unit: 'cm' },
    { key: 'waist', label: 'Contorno de cintura', placeholder: '70', unit: 'cm' },
    { key: 'hips', label: 'Contorno de cadera', placeholder: '95', unit: 'cm' },
    { key: 'shoulder', label: 'Ancho de hombros', placeholder: '38', unit: 'cm' },
    { key: 'inseam', label: 'Largo de entrepierna', placeholder: '75', unit: 'cm' },
  ]

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Tecnología VELOUR</p>
          <h1 className="font-display text-4xl sm:text-5xl font-700 text-[#0D0D0D] mb-3">Crear mi Avatar</h1>
          <p className="text-[#6B6860] text-base max-w-lg">Ingresa tus medidas biométricas para generar tu avatar personalizado. Así podrás probarte ropa virtualmente antes de comprar.</p>
        </div>

        {step === 'form' && (
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <div>
              {/* Gender selector */}
              <div className="mb-6">
                <p className="text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-3">Selecciona tu silueta</p>
                <div className="flex gap-3">
                  {(['F', 'M'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`flex-1 py-3 text-sm font-600 border transition-all ${gender === g ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'bg-white text-[#6B6860] border-[#DDD9D0] hover:border-[#0D0D0D]'}`}
                    >
                      {g === 'F' ? 'Femenina' : 'Masculina'}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-4">
                  {fields.map(f => (
                    <div key={f.key}>
                      <label htmlFor={`avatar-${f.key}`} className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">{f.label}</label>
                      <div className="relative">
                        <input
                          id={`avatar-${f.key}`}
                          type="number"
                          min="0"
                          value={measurements[f.key]}
                          onChange={e => update(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          required
                          className="w-full px-4 py-3 pr-10 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6860] text-xs">{f.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#F2EFE9] border border-[#DDD9D0] p-4 text-xs text-[#6B6860] leading-relaxed">
                  <strong className="text-[#0D0D0D]">¿Cómo tomar mis medidas?</strong><br />
                  Usa una cinta métrica flexible. Mide el contorno en la parte más pronunciada. Para el largo, de la ingle al tobillo.
                </div>

                <button type="submit" className="w-full bg-[#C9A96E] text-[#0D0D0D] py-4 text-sm font-700 tracking-wide uppercase hover:bg-[#b8955c] transition-colors">
                  Generar mi Avatar ◈
                </button>
              </form>
            </div>

            {/* Preview silhouette */}
            <div className="flex flex-col items-center justify-center bg-[#F2EFE9] border border-[#DDD9D0] p-8 min-h-[480px]">
              <p className="text-xs font-600 tracking-[0.2em] uppercase text-[#6B6860] mb-6">Vista previa</p>
              <AvatarSilhouette gender={gender} pulse />
              <p className="text-xs text-[#6B6860] mt-6 text-center">Ingresa tus medidas para<br />generar tu avatar personalizado</p>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-8 opacity-60">
              <AvatarSilhouette gender={gender} pulse />
            </div>
            <p className="font-display text-2xl font-700 text-[#0D0D0D] mb-2">Generando tu avatar...</p>
            <p className="text-[#6B6860] text-sm mb-8">Procesando tus medidas biométricas</p>
            <div className="w-64 h-1 bg-[#DDD9D0] rounded-full overflow-hidden">
              <div ref={progressRef} className="h-full bg-[#C9A96E] rounded-full" style={{ width: '0%' }} />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col items-center bg-[#F2EFE9] border border-[#DDD9D0] p-8">
              <p className="text-xs font-600 tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Tu Avatar</p>
              <AvatarSilhouette svgRef={avatarRef} gender={gender} filled />
              <div className="mt-6 grid grid-cols-2 gap-3 w-full text-center">
                {[
                  { label: 'Talla recomendada', value: 'M' },
                  { label: 'Ajuste', value: '94%' },
                  { label: 'Estatura', value: `${measurements.height || '165'} cm` },
                  { label: 'Contorno', value: `${measurements.chest || '90'} cm` },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-[#DDD9D0] p-3">
                    <p className="text-[10px] text-[#6B6860] uppercase tracking-wide mb-0.5">{s.label}</p>
                    <p className="font-display text-lg font-700 text-[#0D0D0D]">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#C9A96E] text-xl">◆</span>
                <p className="font-600 text-[#0D0D0D]">¡Avatar creado exitosamente!</p>
              </div>
              <p className="text-[#6B6860] text-sm leading-relaxed mb-8">
                Tu avatar personalizado está listo. Ahora puedes explorar nuestra colección y probarte cualquier prenda virtualmente para ver cómo te queda antes de comprar.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setPage('tryon')}
                  className="w-full bg-[#C9A96E] text-[#0D0D0D] py-4 text-sm font-700 tracking-wide uppercase hover:bg-[#b8955c] transition-colors"
                >
                  Probarme ropa ahora →
                </button>
                <button
                  onClick={() => setPage('products')}
                  className="w-full bg-white border border-[#DDD9D0] text-[#0D0D0D] py-3.5 text-sm font-600 tracking-wide uppercase hover:border-[#0D0D0D] transition-colors"
                >
                  Ver catálogo completo
                </button>
                <button
                  onClick={() => setStep('form')}
                  className="w-full text-xs text-[#6B6860] hover:text-[#0D0D0D] transition-colors py-2"
                >
                  Editar medidas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Avatar SVG Figure ────────────────────────────────────────────────────────

// ─── Clothing Overlay Shapes ─────────────────────────────────────────────────
// All paths use the same viewBox as AvatarSilhouette (0 0 160 340)
// Female key coords: shoulders ~y=83 x=54/106, waist ~y=155, hips ~y=192, knee ~y=268

function FemaleGarment({ category, color }: { category: string; color: string }) {
  const dark = shadeColor(color, -18)
  const light = shadeColor(color, 22)
  const mid = color

  if (category === 'Blazers') return (
    <g opacity="0.93">
      {/* Main jacket body */}
      <path d="M56 83 Q42 90 36 108 L32 160 L54 163 L58 135 L58 185 L102 185 L102 135 L106 163 L128 160 L124 108 Q118 90 104 83 Q94 78 80 78 Q66 78 56 83Z" fill={mid} />
      {/* Left lapel */}
      <path d="M68 83 L72 120 L80 110 L80 83Z" fill={dark} />
      {/* Right lapel */}
      <path d="M92 83 L88 120 L80 110 L80 83Z" fill={dark} />
      {/* Collar stand */}
      <path d="M68 83 Q80 92 92 83 Q80 98 68 83Z" fill={light} />
      {/* Waist seam */}
      <line x1="56" y1="148" x2="104" y2="148" stroke={dark} strokeWidth="0.8" />
      {/* Pockets */}
      <rect x="60" y="152" width="14" height="8" rx="1" fill={dark} opacity="0.5" />
      <rect x="86" y="152" width="14" height="8" rx="1" fill={dark} opacity="0.5" />
      {/* Buttons */}
      {[118, 130, 142, 154].map(y => <circle key={y} cx="80" cy={y} r="2" fill={dark} />)}
      {/* Shoulder pads */}
      <path d="M56 83 Q48 80 36 108 Q44 98 56 96Z" fill={light} opacity="0.5" />
      <path d="M104 83 Q112 80 124 108 Q116 98 104 96Z" fill={light} opacity="0.5" />
      {/* Sleeve shading */}
      <path d="M36 108 L32 160 L40 162 L48 120Z" fill={dark} opacity="0.25" />
      <path d="M124 108 L128 160 L120 162 L112 120Z" fill={dark} opacity="0.25" />
    </g>
  )

  if (category === 'Abrigos') return (
    <g opacity="0.93">
      {/* Long coat body down to mid-thigh */}
      <path d="M54 83 Q38 92 32 112 L28 175 L52 178 L56 150 L56 255 L104 255 L104 150 L108 178 L132 175 L128 112 Q122 92 106 83 Q93 77 80 77 Q67 77 54 83Z" fill={mid} />
      {/* Collar / lapels */}
      <path d="M66 83 L70 115 L80 105 L80 83Z" fill={dark} />
      <path d="M94 83 L90 115 L80 105 L80 83Z" fill={dark} />
      <path d="M66 83 Q80 94 94 83 Q80 100 66 83Z" fill={light} />
      {/* Belt */}
      <rect x="52" y="162" width="56" height="10" rx="2" fill={dark} opacity="0.7" />
      <rect x="73" y="163" width="14" height="8" rx="2" fill={shadeColor(color, -40)} opacity="0.9" />
      {/* Center placket + buttons */}
      <line x1="80" y1="106" x2="80" y2="255" stroke={dark} strokeWidth="1.2" strokeDasharray="0" />
      {[118, 132, 148, 180, 200, 220, 240].map(y => <circle key={y} cx="80" cy={y} r="2" fill={dark} />)}
      {/* Hem detail */}
      <line x1="56" y1="253" x2="104" y2="253" stroke={dark} strokeWidth="0.8" />
      {/* Sleeve shading */}
      <path d="M32 112 L28 175 L38 177 L48 130Z" fill={dark} opacity="0.22" />
      <path d="M128 112 L132 175 L122 177 L112 130Z" fill={dark} opacity="0.22" />
    </g>
  )

  if (category === 'Vestidos') return (
    <g opacity="0.93">
      {/* Fitted bodice */}
      <path d="M60 83 Q46 90 42 106 L40 148 L54 152 L56 185 L104 185 L106 152 L120 148 L118 106 Q114 90 100 83 Q91 78 80 78 Q69 78 60 83Z" fill={mid} />
      {/* Flared skirt */}
      <path d="M56 183 Q42 200 36 255 L44 258 Q56 218 70 210 L90 210 Q104 218 116 258 L124 255 Q118 200 104 183Z" fill={light} />
      {/* Waist seam */}
      <line x1="54" y1="184" x2="106" y2="184" stroke={dark} strokeWidth="1" />
      {/* Neckline */}
      <path d="M68 83 Q80 94 92 83" fill="none" stroke={dark} strokeWidth="1.2" />
      {/* Skirt pleats */}
      <line x1="70" y1="184" x2="60" y2="258" stroke={dark} strokeWidth="0.6" opacity="0.5" />
      <line x1="80" y1="184" x2="80" y2="258" stroke={dark} strokeWidth="0.6" opacity="0.5" />
      <line x1="90" y1="184" x2="100" y2="258" stroke={dark} strokeWidth="0.6" opacity="0.5" />
      {/* Cap sleeves */}
      <path d="M60 83 Q46 90 42 106 L54 104 Q58 90 64 86Z" fill={dark} opacity="0.4" />
      <path d="M100 83 Q114 90 118 106 L106 104 Q102 90 96 86Z" fill={dark} opacity="0.4" />
      {/* Hem lace hint */}
      <path d="M36 256 Q56 262 80 260 Q104 262 124 256" stroke={dark} strokeWidth="1" fill="none" strokeDasharray="3 2" />
    </g>
  )

  if (category === 'Conjuntos') return (
    <g opacity="0.93">
      {/* Top / blouse */}
      <path d="M62 83 Q50 88 46 100 L44 140 L58 143 L60 130 L60 160 L100 160 L100 130 L102 143 L116 140 L114 100 Q110 88 98 83 Q90 78 80 78 Q70 78 62 83Z" fill={mid} />
      {/* Wide-leg trousers */}
      <path d="M58 158 L44 270 L68 270 L80 220 L92 270 L116 270 L102 158Z" fill={dark} />
      {/* Coordinated waistband */}
      <rect x="56" y="156" width="48" height="7" rx="1" fill={shadeColor(color, -30)} />
      {/* Top neckline detail */}
      <path d="M68 83 Q80 91 92 83" fill="none" stroke={dark} strokeWidth="1" />
      {/* Top shading */}
      <path d="M80 83 L80 160 Q88 158 94 154 L94 90 Q87 79 80 83Z" fill={dark} opacity="0.2" />
      {/* Pants crease */}
      <line x1="56" y1="165" x2="50" y2="268" stroke={light} strokeWidth="0.8" opacity="0.5" />
      <line x1="104" y1="165" x2="110" y2="268" stroke={light} strokeWidth="0.8" opacity="0.5" />
      {/* Short sleeves */}
      <path d="M46 100 L44 140 L56 138 L58 108Z" fill={dark} opacity="0.25" />
      <path d="M114 100 L116 140 L104 138 L102 108Z" fill={dark} opacity="0.25" />
    </g>
  )

  if (category === 'Camisas') return (
    <g opacity="0.93">
      {/* Shirt body */}
      <path d="M60 83 Q46 88 40 104 L36 160 L58 163 L60 135 L60 185 L100 185 L100 135 L102 163 L124 160 L120 104 Q114 88 100 83 Q91 78 80 78 Q69 78 60 83Z" fill={mid} />
      {/* Collar points */}
      <path d="M68 83 L64 96 L72 90 L80 97 L88 90 L96 96 L92 83 Q80 89 68 83Z" fill={light} />
      {/* Button placket */}
      <rect x="77.5" y="97" width="5" height="88" rx="0" fill={light} opacity="0.5" />
      {[105, 118, 131, 144, 157, 170].map(y => <circle key={y} cx="80" cy={y} r="1.8" fill={dark} />)}
      {/* Pocket */}
      <rect x="60" y="108" width="15" height="12" rx="1.5" fill={dark} opacity="0.35" />
      <line x1="60" y1="113" x2="75" y2="113" stroke={dark} strokeWidth="0.5" opacity="0.5" />
      {/* Sleeves */}
      <path d="M40 104 L36 160 L48 162 L56 120Z" fill={dark} opacity="0.22" />
      <path d="M120 104 L124 160 L112 162 L104 120Z" fill={dark} opacity="0.22" />
      {/* Cuffs */}
      <rect x="33" y="155" width="16" height="8" rx="2" fill={light} opacity="0.8" />
      <rect x="111" y="155" width="16" height="8" rx="2" fill={light} opacity="0.8" />
    </g>
  )

  if (category === 'Pantalones') return (
    <g opacity="0.93">
      {/* Wide-leg pants */}
      <path d="M54 185 L38 268 L66 268 L80 225 L94 268 L122 268 L106 185Z" fill={mid} />
      {/* Waistband */}
      <rect x="52" y="183" width="56" height="8" rx="2" fill={dark} />
      {/* Belt loops */}
      {[60, 72, 80, 88, 100].map(x => (
        <rect key={x} x={x - 2} y="183" width="4" height="10" rx="1" fill={dark} opacity="0.6" />
      ))}
      {/* Belt buckle */}
      <rect x="73" y="184" width="14" height="6" rx="1.5" fill={shadeColor(color, -50)} />
      <rect x="77" y="185" width="6" height="4" rx="1" fill={shadeColor(color, 20)} opacity="0.7" />
      {/* Crease lines */}
      <line x1="56" y1="195" x2="48" y2="266" stroke={light} strokeWidth="1" opacity="0.5" />
      <line x1="104" y1="195" x2="112" y2="266" stroke={light} strokeWidth="1" opacity="0.5" />
      {/* Inner seam */}
      <line x1="80" y1="225" x2="72" y2="266" stroke={dark} strokeWidth="0.7" opacity="0.4" />
      <line x1="80" y1="225" x2="88" y2="266" stroke={dark} strokeWidth="0.7" opacity="0.4" />
      {/* Hem */}
      <line x1="38" y1="266" x2="66" y2="266" stroke={dark} strokeWidth="1.2" />
      <line x1="94" y1="266" x2="122" y2="266" stroke={dark} strokeWidth="1.2" />
    </g>
  )

  return null
}

function shadeColor(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + pct * 2.55))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + pct * 2.55))
  const b = Math.min(255, Math.max(0, (n & 0xff) + pct * 2.55))
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

const CATEGORY_COLORS: Record<string, string> = {
  Blazers: '#3C3A35',
  Abrigos: '#8B6F47',
  Vestidos: '#7D6B8F',
  Conjuntos: '#4A5D6E',
  Camisas: '#D6C9B0',
  Pantalones: '#2C3E50',
}

// ─── Avatar SVG Figure ────────────────────────────────────────────────────────

const AvatarSilhouette = ({
  gender, pulse, filled, svgRef: externalRef, clothing
}: {
  gender: 'F' | 'M'
  pulse?: boolean
  filled?: boolean
  svgRef?: React.RefObject<SVGSVGElement | null>
  clothing?: { category: string; color: string }
}) => {
  const internalRef = useRef<SVGSVGElement>(null)
  const resolvedRef = externalRef || internalRef

  const skin = filled ? '#D4A882' : '#9E8060'
  const hair = filled ? '#3D2B1F' : '#6B5040'
  const cloth = filled ? '#C9A96E' : '#8A7050'
  const clothDark = filled ? '#B8955C' : '#7A6040'
  const pants = filled ? '#2A2A2A' : '#555'
  const stroke = filled ? 'none' : '#6B6860'
  const strokeW = filled ? '0' : '0.8'
  const cls = pulse ? 'avatar-silhouette' : undefined

  if (gender === 'F') {
    return (
      <svg ref={resolvedRef} viewBox="0 0 160 340" width="160" height="320" aria-label="Avatar femenino" role="img" className={cls}>
        {/* Hair back */}
        <ellipse cx="80" cy="36" rx="28" ry="32" fill={hair} stroke={stroke} strokeWidth={strokeW} />
        <path d="M52 50 Q40 90 44 130 Q50 110 58 95 Z" fill={hair} />
        <path d="M108 50 Q120 90 116 130 Q110 110 102 95 Z" fill={hair} />

        {/* Neck */}
        <rect x="72" y="65" width="16" height="18" rx="4" fill={skin} stroke={stroke} strokeWidth={strokeW} />

        {/* Head */}
        <ellipse cx="80" cy="40" rx="26" ry="28" fill={skin} stroke={stroke} strokeWidth={strokeW} />

        {/* Face details */}
        {filled && <>
          {/* Eyes */}
          <ellipse cx="70" cy="36" rx="4" ry="4.5" fill="#fff" />
          <ellipse cx="90" cy="36" rx="4" ry="4.5" fill="#fff" />
          <circle cx="70.5" cy="37" r="2.5" fill="#3D2B1F" />
          <circle cx="90.5" cy="37" r="2.5" fill="#3D2B1F" />
          <circle cx="71.2" cy="36.2" r="0.8" fill="#fff" />
          <circle cx="91.2" cy="36.2" r="0.8" fill="#fff" />
          {/* Eyebrows */}
          <path d="M65 30 Q70 27.5 75 30" stroke="#3D2B1F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M85 30 Q90 27.5 95 30" stroke="#3D2B1F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {/* Nose */}
          <path d="M78 40 Q80 45 82 40" stroke={skin === '#D4A882' ? '#C0906A' : '#8A6A4A'} strokeWidth="1" fill="none" strokeLinecap="round" />
          {/* Lips */}
          <path d="M73 50 Q80 54 87 50" stroke="#C07060" strokeWidth="1.2" fill="#E09080" strokeLinecap="round" />
          {/* Cheeks */}
          <circle cx="63" cy="44" r="5" fill="#E8908080" />
          <circle cx="97" cy="44" r="5" fill="#E8908080" />
        </>}

        {/* Hair front top */}
        <path d="M54 25 Q58 8 80 6 Q102 8 106 25 Q98 15 80 14 Q62 15 54 25Z" fill={hair} />
        {/* Hair side strands */}
        <path d="M54 25 Q46 35 48 55 Q54 45 58 38Z" fill={hair} />
        <path d="M106 25 Q114 35 112 55 Q106 45 102 38Z" fill={hair} />

        {/* Body — blouse/top */}
        <path d="M58 83 Q44 88 38 100 L32 145 L52 148 L56 125 L56 180 L104 180 L104 125 L108 148 L128 145 L122 100 Q116 88 102 83 Q92 78 80 78 Q68 78 58 83Z"
          fill={cloth} stroke={stroke} strokeWidth={strokeW} />
        {/* Blouse shading */}
        {filled && <path d="M80 83 L80 180 Q88 178 96 174 L96 90 Q88 82 80 83Z" fill={clothDark} opacity="0.35" />}
        {/* Neckline detail */}
        <path d="M68 83 Q80 90 92 83" fill="none" stroke={filled ? clothDark : stroke} strokeWidth="1" />

        {/* Arms */}
        <path d="M38 100 Q28 115 26 135 Q30 140 36 137 Q40 118 50 105Z" fill={skin} stroke={stroke} strokeWidth={strokeW} />
        <path d="M122 100 Q132 115 134 135 Q130 140 124 137 Q120 118 110 105Z" fill={skin} stroke={stroke} strokeWidth={strokeW} />
        {/* Hands */}
        <ellipse cx="31" cy="140" rx="7" ry="5" fill={skin} />
        <ellipse cx="129" cy="140" rx="7" ry="5" fill={skin} />

        {/* Skirt */}
        <path d="M56 178 Q44 190 40 230 L48 232 Q56 205 68 198 L92 198 Q104 205 112 232 L120 230 Q116 190 104 178Z"
          fill={pants} stroke={stroke} strokeWidth={strokeW} />
        {/* Skirt fold */}
        {filled && <path d="M80 178 L74 232 L80 232 L86 232 L80 178Z" fill="#ffffff18" />}

        {/* Legs */}
        <rect x="48" y="230" width="26" height="75" rx="8" fill={skin} stroke={stroke} strokeWidth={strokeW} />
        <rect x="86" y="230" width="26" height="75" rx="8" fill={skin} stroke={stroke} strokeWidth={strokeW} />
        {/* Leg shading */}
        {filled && <>
          <rect x="60" y="230" width="8" height="75" rx="4" fill="#00000015" />
          <rect x="98" y="230" width="8" height="75" rx="4" fill="#00000015" />
        </>}

        {/* Shoes */}
        <ellipse cx="61" cy="306" rx="15" ry="7" fill={hair} />
        <ellipse cx="99" cy="306" rx="15" ry="7" fill={hair} />
        {/* Heel */}
        {filled && <>
          <rect x="70" y="303" width="4" height="9" rx="2" fill={hair} />
          <rect x="108" y="303" width="4" height="9" rx="2" fill={hair} />
        </>}

        {/* Clothing overlay */}
        {clothing && <FemaleGarment category={clothing.category} color={clothing.color} />}

        {/* Scan lines overlay */}
        {filled && !clothing && [100, 145, 195, 245, 295].map(y => (
          <line key={y} x1="20" y1={y} x2="140" y2={y} stroke="#C9A96E" strokeWidth="0.4" strokeDasharray="4 5" opacity="0.3" />
        ))}
        {filled && !clothing && [
          [80, 83], [56, 145], [104, 145], [48, 198], [112, 198]
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#C9A96E" opacity="0.7" />
        ))}
      </svg>
    )
  }

  // Male figure
  return (
    <svg ref={resolvedRef} viewBox="0 0 160 340" width="160" height="320" aria-label="Avatar masculino" role="img" className={cls}>
      {/* Hair */}
      <ellipse cx="80" cy="34" rx="28" ry="30" fill={hair} stroke={stroke} strokeWidth={strokeW} />
      <path d="M54 22 Q58 5 80 4 Q102 5 106 22 Q98 13 80 12 Q62 13 54 22Z" fill={hair} />

      {/* Neck */}
      <rect x="70" y="62" width="20" height="18" rx="4" fill={skin} stroke={stroke} strokeWidth={strokeW} />

      {/* Head */}
      <ellipse cx="80" cy="38" rx="28" ry="30" fill={skin} stroke={stroke} strokeWidth={strokeW} />

      {/* Face details */}
      {filled && <>
        <ellipse cx="69" cy="36" rx="4.5" ry="4.5" fill="#fff" />
        <ellipse cx="91" cy="36" rx="4.5" ry="4.5" fill="#fff" />
        <circle cx="69.5" cy="37" r="2.8" fill="#3D2B1F" />
        <circle cx="91.5" cy="37" r="2.8" fill="#3D2B1F" />
        <circle cx="70.2" cy="36" r="0.9" fill="#fff" />
        <circle cx="92.2" cy="36" r="0.9" fill="#fff" />
        {/* Brows */}
        <path d="M63 29 Q69 26 75 29" stroke="#3D2B1F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M85 29 Q91 26 97 29" stroke="#3D2B1F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* Nose */}
        <path d="M77 41 Q80 47 83 41" stroke={skin === '#D4A882' ? '#BF8060' : '#8A6040'} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Mouth */}
        <path d="M73 52 Q80 56 87 52" stroke="#9A6050" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Jaw definition */}
        <path d="M54 50 Q56 68 80 72 Q104 68 106 50" stroke="#BF906A" strokeWidth="0.6" fill="none" opacity="0.5" />
      </>}

      {/* Shirt body */}
      <path d="M54 80 Q36 86 30 102 L26 155 L50 158 L54 130 L54 192 L106 192 L106 130 L110 158 L134 155 L130 102 Q124 86 106 80 Q94 75 80 75 Q66 75 54 80Z"
        fill={cloth} stroke={stroke} strokeWidth={strokeW} />
      {/* Shirt shading */}
      {filled && <path d="M80 80 L80 192 Q90 190 98 185 L98 88 Q89 76 80 80Z" fill={clothDark} opacity="0.3" />}
      {/* Collar */}
      <path d="M68 80 L80 95 L92 80" fill={filled ? '#FAF8F5' : 'none'} stroke={filled ? clothDark : stroke} strokeWidth="1" />
      {/* Shirt pocket */}
      {filled && <rect x="58" y="105" width="18" height="14" rx="2" fill={clothDark} opacity="0.4" />}
      {/* Button line */}
      {filled && [108, 122, 136, 150, 164, 178].map(y => (
        <circle key={y} cx="80" cy={y} r="1.5" fill={clothDark} opacity="0.5" />
      ))}

      {/* Arms */}
      <path d="M30 102 Q18 120 16 144 Q21 150 28 147 Q32 124 44 110Z" fill={skin} stroke={stroke} strokeWidth={strokeW} />
      <path d="M130 102 Q142 120 144 144 Q139 150 132 147 Q128 124 116 110Z" fill={skin} stroke={stroke} strokeWidth={strokeW} />
      {/* Hands */}
      <ellipse cx="21" cy="148" rx="8" ry="6" fill={skin} />
      <ellipse cx="139" cy="148" rx="8" ry="6" fill={skin} />

      {/* Pants */}
      <path d="M54 190 L44 270 L72 270 L80 230 L88 270 L116 270 L106 190Z"
        fill={pants} stroke={stroke} strokeWidth={strokeW} />
      {/* Belt */}
      <rect x="52" y="188" width="56" height="8" rx="2" fill={filled ? '#5A4030' : '#444'} />
      {/* Belt buckle */}
      {filled && <rect x="74" y="189" width="12" height="6" rx="1" fill="#C9A96E" />}
      {/* Pants crease */}
      {filled && <>
        <line x1="58" y1="200" x2="54" y2="268" stroke="#ffffff18" strokeWidth="1.5" />
        <line x1="102" y1="200" x2="106" y2="268" stroke="#ffffff18" strokeWidth="1.5" />
      </>}

      {/* Legs */}
      <rect x="44" y="268" width="30" height="52" rx="8" fill={skin} stroke={stroke} strokeWidth={strokeW} />
      <rect x="86" y="268" width="30" height="52" rx="8" fill={skin} stroke={stroke} strokeWidth={strokeW} />

      {/* Shoes */}
      <path d="M40 315 Q44 322 72 322 Q76 318 74 312 L44 312Z" fill={hair} />
      <path d="M88 315 Q88 322 116 322 Q120 318 118 312 L88 312Z" fill={hair} />
      {/* Shoe detail */}
      {filled && <>
        <path d="M62 316 Q66 319 70 316" stroke="#ffffff30" strokeWidth="0.8" fill="none" />
        <path d="M98 316 Q102 319 106 316" stroke="#ffffff30" strokeWidth="0.8" fill="none" />
      </>}

      {/* Clothing overlay (male uses same shapes, coords are tuned for 160x340) */}
      {clothing && <FemaleGarment category={clothing.category} color={clothing.color} />}

      {/* Scan lines */}
      {filled && !clothing && [100, 148, 195, 245, 295].map(y => (
        <line key={y} x1="10" y1={y} x2="150" y2={y} stroke="#C9A96E" strokeWidth="0.4" strokeDasharray="4 5" opacity="0.3" />
      ))}
      {filled && !clothing && [
        [80, 80], [52, 155], [108, 155], [54, 190], [106, 190]
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#C9A96E" opacity="0.7" />
      ))}
    </svg>
  )
}

// ─── Virtual Try-On Page ──────────────────────────────────────────────────────

function TryOnPage({ setPage }: { setPage: (p: Page) => void }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeClothing, setActiveClothing] = useState<{ category: string; color: string } | undefined>()
  const pageRef = useGsapEntrance([])
  const avatarWrapRef = useRef<HTMLDivElement>(null)

  function tryOn(p: Product) {
    const color = CATEGORY_COLORS[p.category] ?? '#3C3A35'
    // Flash-swap animation: fade out → swap → fade in
    if (avatarWrapRef.current) {
      gsap.to(avatarWrapRef.current, {
        opacity: 0, scale: 0.96, duration: 0.18, ease: 'power2.in',
        onComplete: () => {
          setSelectedProduct(p)
          setActiveClothing({ category: p.category, color })
          gsap.to(avatarWrapRef.current, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)' })
        }
      })
    } else {
      setSelectedProduct(p)
      setActiveClothing({ category: p.category, color })
    }
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-[#FAF8F5] pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <p className="text-[#C9A96E] text-xs font-600 tracking-[0.3em] uppercase mb-2">Probador Virtual</p>
          <h1 className="font-display text-4xl sm:text-5xl font-700 text-[#0D0D0D] mb-3">Pruébate la ropa</h1>
          <p className="text-[#6B6860] text-sm max-w-md">Selecciona una prenda del catálogo y mira cómo queda sobre tu avatar con la silueta de la prenda dibujada a escala.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Avatar preview */}
          <div className="lg:col-span-2">
            <div className="relative bg-[#F2EFE9] border-2 border-dashed border-[#DDD9D0] min-h-[560px] flex flex-col items-center justify-center overflow-hidden">
              {/* Background grid */}
              <div className="absolute inset-0 opacity-15"
                style={{ backgroundImage: 'linear-gradient(#DDD9D0 1px, transparent 1px), linear-gradient(90deg, #DDD9D0 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

              {/* Corner labels */}
              <div className="absolute top-3 left-3 text-[#6B6860] text-[10px] font-600 tracking-widest uppercase">Vista frontal</div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" />
                <span className="text-[10px] font-600 text-[#C9A96E] uppercase tracking-widest">Avatar activo</span>
              </div>

              {/* Avatar */}
              <div ref={avatarWrapRef} className="relative flex flex-col items-center py-6">
                <AvatarSilhouette gender="F" filled clothing={activeClothing} />

                {/* Garment label chip */}
                {selectedProduct && (
                  <div className="mt-3 flex items-center gap-2 bg-white border border-[#DDD9D0] px-3 py-1.5 shadow-sm">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: activeClothing?.color }} />
                    <span className="text-[11px] font-600 text-[#0D0D0D] tracking-wide">{selectedProduct.name}</span>
                    <span className="text-[10px] text-[#6B6860]">· {selectedProduct.category}</span>
                  </div>
                )}

                {/* Side measurement annotations */}
                <div className="absolute right-0 top-12 flex flex-col gap-5 text-[10px] text-[#6B6860] font-500 pr-1">
                  {[['Hombros', '38 cm'], ['Pecho', '90 cm'], ['Cintura', '70 cm'], ['Cadera', '95 cm']].map(([l, v]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-5 h-px bg-[#C9A96E]/60" />
                      <div>
                        <div className="text-[#0D0D0D] font-600 leading-tight">{v}</div>
                        <div className="text-[#6B6860]/70 leading-tight">{l}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!selectedProduct && (
                <p className="absolute bottom-10 text-sm text-[#6B6860]/60 italic">← Elige una prenda para verla en el avatar</p>
              )}

              {/* Badge */}
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="bg-[#0D0D0D]/75 text-white text-[10px] font-600 px-3 py-1.5 tracking-widest uppercase">
                  ◈ Visualización vectorial · 3D próximamente
                </span>
              </div>
            </div>

            {/* Controls bar */}
            {selectedProduct && (
              <div className="mt-4 flex flex-wrap gap-3 items-center justify-between bg-white border border-[#DDD9D0] px-4 py-3">
                <div className="flex items-center gap-3">
                  <img src={selectedProduct.img} alt="" className="w-10 h-12 object-cover bg-[#E8E4DC]" />
                  <div>
                    <p className="text-xs text-[#6B6860] mb-0.5">{selectedProduct.category}</p>
                    <p className="font-display font-600 text-[#0D0D0D] text-sm">{selectedProduct.name}</p>
                    <p className="text-xs text-[#C9A96E] font-600">{formatPrice(selectedProduct.price)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['Frontal', 'Lateral', 'Trasera'].map((v, i) => (
                    <button key={v} className={`text-xs px-3 py-1.5 border transition-colors ${i === 0 ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-[#DDD9D0] text-[#6B6860] hover:border-[#0D0D0D]'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product list */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            <p className="text-xs font-600 tracking-[0.2em] uppercase text-[#6B6860] sticky top-0 bg-[#FAF8F5] py-1">Elige una prenda</p>
            {PRODUCTS.map(p => (
              <button
                key={p.id}
                onClick={() => tryOn(p)}
                className={`w-full flex gap-3 p-3 text-left border transition-all ${selectedProduct?.id === p.id ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-[#DDD9D0] bg-white hover:border-[#6B6860]'}`}
              >
                <img src={p.img} alt={p.name} className="w-14 h-16 object-cover bg-[#E8E4DC] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[#6B6860] uppercase tracking-wide mb-0.5">{p.category}</p>
                  <p className="text-sm font-600 text-[#0D0D0D] truncate mb-1">{p.name}</p>
                  <p className="text-xs text-[#6B6860]">{formatPrice(p.price)}</p>
                </div>
                {selectedProduct?.id === p.id && (
                  <span className="ml-auto text-[#C9A96E] shrink-0">◆</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => setPage('products')} className="bg-[#0D0D0D] text-white px-6 py-3 text-sm font-600 tracking-wide uppercase hover:bg-[#C9A96E] hover:text-[#0D0D0D] transition-colors">
            Ver catálogo completo
          </button>
          <button onClick={() => setPage('avatar')} className="border border-[#DDD9D0] text-[#6B6860] px-6 py-3 text-sm font-600 tracking-wide uppercase hover:border-[#0D0D0D] hover:text-[#0D0D0D] transition-colors">
            Editar avatar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Checkout Page ───────────────────────────────────────────────────────────

type CheckoutStep = 'shipping' | 'payment' | 'confirm'

function CheckoutPage({ cart, onSuccess }: { cart: CartItem[]; onSuccess: () => void }) {
  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [processing, setProcessing] = useState(false)
  const [payMethod, setPayMethod] = useState<'card' | 'pse' | 'nequi'>('card')
  const [shipping, setShipping] = useState({ name: '', lastname: '', email: '', phone: '', address: '', city: '', dept: '', zip: '' })
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const pageRef = useGsapEntrance([])
  const panelRef = useRef<HTMLDivElement>(null)

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping_fee = subtotal >= 200000 ? 0 : 15000
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

  function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    setProcessing(true)
    const tick = () => {
      if (spinnerRef.current) {
        gsap.fromTo(spinnerRef.current, { rotation: 0, transformOrigin: '50% 50%' }, {
          rotation: 360, duration: 1, repeat: 2, ease: 'linear',
          onComplete: () => { setProcessing(false); animateStep('confirm') }
        })
      } else {
        setTimeout(tick, 50)
      }
    }
    setTimeout(tick, 30)
  }

  const orderNum = `VL-${Math.floor(100000 + Math.random() * 900000)}`

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
                      <input id="sh-phone" type="tel" required autoComplete="tel" placeholder="+57 300 123 4567"
                        value={shipping.phone} onChange={e => setShipping(s => ({ ...s, phone: e.target.value }))}
                        className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sh-address" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Dirección</label>
                    <input id="sh-address" type="text" required autoComplete="street-address" placeholder="Calle 123 # 45-67, Apto 8"
                      value={shipping.address} onChange={e => setShipping(s => ({ ...s, address: e.target.value }))}
                      className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { id: 'sh-city', label: 'Ciudad', key: 'city', placeholder: 'Bogotá', auto: 'address-level2' },
                      { id: 'sh-dept', label: 'Departamento', key: 'dept', placeholder: 'Cundinamarca', auto: 'address-level1' },
                      { id: 'sh-zip', label: 'Código postal', key: 'zip', placeholder: '110111', auto: 'postal-code' },
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
                      { id: 'pse', label: 'PSE', icon: (
                        <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
                          <rect width="38" height="24" rx="4" fill="#004B8D"/>
                          <text x="19" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">PSE</text>
                        </svg>
                      )},
                      { id: 'nequi', label: 'Nequi', icon: (
                        <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
                          <rect width="38" height="24" rx="4" fill="#6C0F8B"/>
                          <text x="19" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">nequi</text>
                        </svg>
                      )},
                    ] as { id: 'card' | 'pse' | 'nequi'; label: string; icon: React.ReactNode }[]).map(m => (
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

                  {payMethod === 'pse' && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="pse-bank" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Banco</label>
                        <select id="pse-bank" required className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors">
                          <option value="">Selecciona tu banco</option>
                          {['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Popular', 'Colpatria', 'Occidente'].map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="pse-doc" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Tipo de persona</label>
                        <div className="grid grid-cols-2 gap-3">
                          {['Natural', 'Jurídica'].map(t => (
                            <label key={t} className="flex items-center gap-2 border border-[#DDD9D0] px-4 py-3 cursor-pointer hover:border-[#C9A96E] transition-colors">
                              <input type="radio" name="pse-type" value={t} className="accent-[#C9A96E]" defaultChecked={t === 'Natural'} />
                              <span className="text-sm text-[#0D0D0D]">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="pse-nit" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Número de documento</label>
                        <input id="pse-nit" type="text" inputMode="numeric" placeholder="1234567890" required
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    </div>
                  )}

                  {payMethod === 'nequi' && (
                    <div className="space-y-4">
                      <div className="bg-[#6C0F8B]/5 border border-[#6C0F8B]/20 p-4 text-sm text-[#6B6860]">
                        Recibirás una notificación en tu app Nequi para confirmar el pago de <strong className="text-[#0D0D0D]">{formatPrice(total)}</strong>.
                      </div>
                      <div>
                        <label htmlFor="nequi-phone" className="block text-xs font-600 tracking-wide uppercase text-[#6B6860] mb-1.5">Número Nequi (celular)</label>
                        <input id="nequi-phone" type="tel" inputMode="numeric" placeholder="300 123 4567" required
                          className="w-full px-4 py-3 border border-[#DDD9D0] text-sm font-mono tracking-widest focus:border-[#C9A96E] focus:outline-none bg-white transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* Security badges */}
                  <div className="flex items-center gap-3 py-3 border-t border-[#DDD9D0]">
                    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><path d="M8 0L0 3v7c0 5.25 3.5 10.15 8 11.5C12.5 20.15 16 15.25 16 10V3L8 0z" fill="#C9A96E" opacity="0.8"/></svg>
                    <p className="text-[10px] text-[#6B6860]">Pago 100% seguro · Encriptación SSL 256-bit · PCI-DSS compliant</p>
                  </div>

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
          <ConfirmStep orderNum={orderNum} total={total} cart={cart} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  )
}

function ConfirmStep({ orderNum, total, cart, onSuccess }: { orderNum: string; total: number; cart: CartItem[]; onSuccess: () => void }) {
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
      <p className="text-sm text-[#0D0D0D] font-600 mb-8">Número de orden: <span className="text-[#C9A96E]">{orderNum}</span></p>

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

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = useCallback((product: Product, size: string) => {
    setCart(c => {
      const existing = c.find(i => i.id === product.id && i.size === size)
      if (existing) return c.map(i => i.id === product.id && i.size === size ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { ...product, qty: 1, size }]
    })
  }, [])

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  function handleCheckoutSuccess() {
    setCart([])
    setPage('home')
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const hideNav = page === 'checkout'

  return (
    <>
      {!hideNav && <Navbar page={page} setPage={setPage} cartCount={cartCount} />}

      <main>
        {page === 'home' && <HomePage setPage={setPage} />}
        {page === 'products' && <ProductsPage setPage={setPage} addToCart={addToCart} />}
        {page === 'cart' && <CartPage cart={cart} setCart={setCart} setPage={setPage} onCheckout={() => setPage('checkout')} />}
        {page === 'login' && <LoginPage setPage={setPage} />}
        {page === 'register' && <RegisterPage setPage={setPage} />}
        {page === 'avatar' && <AvatarPage setPage={setPage} />}
        {page === 'tryon' && <TryOnPage setPage={setPage} />}
        {page === 'checkout' && <CheckoutPage cart={cart} onSuccess={handleCheckoutSuccess} />}
      </main>

      <WhatsAppFAB />
    </>
  )
}
