import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando generación de reporte...")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    const { data: { users }, error: userError } = await supabaseClient.auth.admin.listUsers()
    
    if (userError || !users || users.length === 0) {
      throw new Error('No se encontró ningún usuario.')
    }

    const user = users[0]
    console.log(`👤 Usuario: ${user.email}`)

    // --- CORRECCIÓN DE FECHAS ---
    const now = new Date()
    
    // Calcular "Mes Anterior" de forma segura (automáticamente maneja años bisiestos y cambio de año)
    // Ejemplo: Si hoy es 16 de Enero 2026 -> startDate será 1 de Diciembre 2025
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    
    // Calcular "Límite superior" (1ro de este mes)
    // Ejemplo: Si hoy es 16 de Enero 2026 -> endDate será 1 de Enero 2026
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1)

    // Convertir a texto YYYY-MM-DD para Supabase
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]
    
    const monthName = startDate.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
    
    console.log(`📅 Buscando desde ${startStr} hasta ${endStr}`)
    // -----------------------------

    const { data: movimientos, error: movError } = await supabaseClient
      .from('movimientos') 
      .select(`
        *,
        cuenta:cuentas(nombre),
        categoria:categorias(nombre)
      `)
      .eq('user_id', user.id)
      .gte('fecha', startStr) // Usamos la fecha segura
      .lt('fecha', endStr)    // Usamos la fecha segura
      .order('fecha', { ascending: true })

    if (movError) throw movError

    console.log(`📊 Movimientos encontrados: ${movimientos?.length || 0}`)

    if (!movimientos || movimientos.length === 0) {
       await enviarCorreo(user.email, `Reporte ${monthName} (Vacío)`, `<p>No hubo movimientos en ${monthName}.</p>`, null)
       return new Response(JSON.stringify({ message: 'Reporte vacío enviado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generar CSV
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Monto USD']
    const rows = movimientos.map(m => [
      new Date(m.fecha).toLocaleDateString('es-VE'),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      m.categoria?.nombre || 'Sin categoría',
      m.cuenta?.nombre || 'N/A',
      parseFloat(m.monto_usd_final).toFixed(2)
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const csvBase64 = btoa(csvContent)

    // Enviar con CSV
    await enviarCorreo(
      user.email, 
      `📊 Reporte Mensual - ${monthName}`, 
      `<h1>Hola!</h1><p>Adjunto tienes tu reporte de <strong>${monthName}</strong> con <strong>${movimientos.length}</strong> movimientos.</p>`,
      { filename: `Reporte_${monthName}.csv`, content: csvBase64 }
    )

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("🚨 Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

async function enviarCorreo(to, subject, html, attachment) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const body = {
    from: 'onboarding@resend.dev',
    to: to,
    subject: subject,
    html: html,
    attachments: attachment ? [attachment] : []
  }
  
  const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const err = await res.json()
    console.error("Error Resend:", err)
    throw new Error(JSON.stringify(err))
  }
}