import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Movimiento {
  fecha: string
  tipo: string
  categoria: { nombre: string } | null
  cuenta: { nombre: string } | null
  moneda_movimiento: string
  monto_original: number
  tasa_aplicada: number | null
  monto_usd_final: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // PASO 1: Calcular el mes anterior
    const now = new Date()
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const añoAnterior = mesAnterior.getFullYear()
    const mesNumero = mesAnterior.getMonth() + 1
    
    // Primer y último día del mes anterior
    const primerDia = new Date(añoAnterior, mesNumero - 1, 1)
    const ultimoDia = new Date(añoAnterior, mesNumero, 0)
    
    const fechaInicio = primerDia.toISOString().split('T')[0]
    const fechaFin = ultimoDia.toISOString().split('T')[0]

    console.log(`📅 Generando reporte del mes: ${mesNumero}/${añoAnterior}`)
    console.log(`📅 Rango: ${fechaInicio} a ${fechaFin}`)

    // PASO 2: Obtener todos los movimientos del mes anterior
    const { data: movimientos, error: movError } = await supabase
      .from('movimientos')
      .select(`
        *,
        categoria:categorias(nombre),
        cuenta:cuentas(nombre)
      `)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })

    if (movError) {
      throw new Error(`Error obteniendo movimientos: ${movError.message}`)
    }

    if (!movimientos || movimientos.length === 0) {
      console.log('ℹ️ No hay movimientos para el mes anterior')
      return new Response(
        JSON.stringify({ message: 'No hay movimientos para reportar', periodo: `${mesNumero}/${añoAnterior}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Encontrados ${movimientos.length} movimientos`)

    // PASO 3: Obtener todos los usuarios únicos de los movimientos
    const userIds = [...new Set(movimientos.map(m => m.user_id))]
    
    // PASO 4: Obtener emails de los usuarios
    const { data: usuarios, error: userError } = await supabase.auth.admin.listUsers()
    
    if (userError) {
      throw new Error(`Error obteniendo usuarios: ${userError.message}`)
    }

    // PASO 5: Generar y enviar reporte para cada usuario
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY no configurada. Los emails no se enviarán.')
    }

    for (const userId of userIds) {
      const usuario = usuarios.users.find(u => u.id === userId)
      if (!usuario || !usuario.email) {
        console.log(`⚠️ Usuario ${userId} sin email, saltando...`)
        continue
      }

      // Filtrar movimientos de este usuario
      const movimientosUsuario = movimientos.filter(m => m.user_id === userId)
      
      // Generar CSV
      const csv = generarCSV(movimientosUsuario as Movimiento[])
      
      // Enviar email
      if (resendApiKey) {
        await enviarEmail(usuario.email, csv, mesNumero, añoAnterior, resendApiKey)
        console.log(`✅ Reporte enviado a ${usuario.email}`)
      } else {
        console.log(`📧 Reporte generado para ${usuario.email} (${movimientosUsuario.length} movimientos)`)
        console.log('CSV Preview:', csv.split('\n').slice(0, 3).join('\n'))
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        periodo: `${mesNumero}/${añoAnterior}`,
        usuarios: userIds.length,
        movimientos: movimientos.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Genera el CSV con el formato detallado
 */
function generarCSV(movimientos: Movimiento[]): string {
  const headers = [
    'Fecha',
    'Tipo',
    'Categoría',
    'Cuenta',
    'Moneda Original',
    'Monto Original',
    'Tasa Aplicada',
    'Monto USD Final'
  ]

  const rows = movimientos.map(m => [
    formatearFecha(m.fecha),
    m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
    m.categoria?.nombre || 'Sin categoría',
    m.cuenta?.nombre || 'N/A',
    m.moneda_movimiento || 'USD',
    parseFloat(m.monto_original?.toString() || '0').toFixed(2),
    m.tasa_aplicada ? parseFloat(m.tasa_aplicada.toString()).toFixed(2) : 'N/A',
    parseFloat(m.monto_usd_final?.toString() || '0').toFixed(2)
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escapar comas y comillas
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }).join(','))
  ].join('\n')
}

/**
 * Formatea una fecha de YYYY-MM-DD a DD/MM/YYYY
 */
function formatearFecha(fechaStr: string): string {
  const [year, month, day] = fechaStr.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Envía el email con el CSV adjunto usando Resend
 */
async function enviarEmail(
  destinatario: string, 
  csvContent: string, 
  mes: number, 
  año: number,
  apiKey: string
): Promise<void> {
  const mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const nombreMes = mesesNombres[mes - 1]

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: 'Finanzas VE <onboarding@resend.dev>', // ⚠️ Cambiar por tu dominio verificado
      to: ['chechechristiansen@gmail.com'],
      subject: `📊 Reporte Mensual de Finanzas - ${nombreMes} ${año}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Reporte Mensual de Finanzas</h2>
          <p>Hola,</p>
          <p>Adjunto encontrarás tu reporte detallado de movimientos del mes de <strong>${nombreMes} ${año}</strong>.</p>
          <p>El archivo CSV incluye:</p>
          <ul>
            <li>Fecha de cada movimiento</li>
            <li>Tipo (Ingreso/Egreso)</li>
            <li>Categoría</li>
            <li>Cuenta</li>
            <li>Moneda original y monto</li>
            <li>Tasa de cambio aplicada</li>
            <li>Monto en USD</li>
          </ul>
          <p style="margin-top: 20px;">Saludos,<br><strong>Finanzas VE</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `Reporte_Finanzas_${nombreMes}_${año}.csv`,
          content: btoa(csvContent) // Base64 encode
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Error enviando email: ${error}`)
  }
}