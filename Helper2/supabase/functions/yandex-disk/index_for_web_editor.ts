// Supabase Edge Function для работы с Яндекс Диском
// Позволяет просматривать файлы и папки без backend сервера
// ВЕРСИЯ ДЛЯ ВЕБ-РЕДАКТОРА (с встроенными CORS заголовками)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS заголовки (встроены для веб-редактора)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const YANDEX_DISK_API_BASE = "https://cloud-api.yandex.net/v1/disk"

serve(async (req) => {
  // Обработка CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'files'
    const folderPath = url.searchParams.get('folder_path') || ''
    const filePath = url.searchParams.get('file_path') || ''
    
    // Получаем секреты из переменных окружения Supabase
    const publicKey = Deno.env.get('YANDEX_DISK_PUBLIC_KEY')
    const token = Deno.env.get('YANDEX_DISK_TOKEN')
    
    if (!publicKey && !token) {
      return new Response(
        JSON.stringify({ 
          error: 'YANDEX_DISK_PUBLIC_KEY или YANDEX_DISK_TOKEN не настроены в Supabase Secrets' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Действие 1: Получить список файлов из папки
    if (action === 'files') {
      let yandexUrl: string
      let headers: HeadersInit = { 'Accept': 'application/json' }
      
      if (publicKey) {
        // Публичная папка
        const publicUrl = `https://disk.yandex.ru/d/${publicKey}`
        yandexUrl = `${YANDEX_DISK_API_BASE}/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=10000`
        
        if (folderPath) {
          yandexUrl += `&path=${encodeURIComponent(folderPath)}`
        }
      } else {
        // OAuth токен
        const path = folderPath || '/'
        yandexUrl = `${YANDEX_DISK_API_BASE}/resources?path=${encodeURIComponent(path)}&limit=10000`
        headers['Authorization'] = `OAuth ${token}`
      }
      
      const response = await fetch(yandexUrl, { headers })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Yandex API error ${response.status}:`, errorText)
        throw new Error(`Yandex API error ${response.status}: ${errorText.substring(0, 200)}`)
      }
      
      const data = await response.json()
      const items = data._embedded?.items || []
      
      return new Response(
        JSON.stringify({
          files: items.map((item: any) => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size || 0,
            mime_type: item.mime_type || '',
            modified: item.modified,
            created: item.created,
            preview: item.preview || '',
            public_key: publicKey
          })),
          total: items.length,
          folder_path: folderPath || '/',
          is_public: !!publicKey,
          public_key: publicKey
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Действие 2: Получить ссылку для скачивания файла
    if (action === 'download-link') {
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: 'file_path обязателен для скачивания' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      let yandexUrl: string
      let headers: HeadersInit = { 'Accept': 'application/json' }
      
      if (publicKey) {
        const publicUrl = `https://disk.yandex.ru/d/${publicKey}`
        yandexUrl = `${YANDEX_DISK_API_BASE}/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(filePath)}`
      } else {
        yandexUrl = `${YANDEX_DISK_API_BASE}/resources/download?path=${encodeURIComponent(filePath)}`
        headers['Authorization'] = `OAuth ${token}`
      }
      
      const response = await fetch(yandexUrl, { headers })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Yandex API error ${response.status}: ${errorText.substring(0, 200)}`)
      }
      
      const data = await response.json()
      
      return new Response(
        JSON.stringify({ download_url: data.href }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Действие 3: Получить ссылку для просмотра файла
    if (action === 'view-link') {
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: 'file_path обязателен для просмотра' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      let yandexUrl: string
      let headers: HeadersInit = { 'Accept': 'application/json' }
      
      if (publicKey) {
        const publicUrl = `https://disk.yandex.ru/d/${publicKey}`
        // Для публичных папок получаем информацию о файле
        yandexUrl = `${YANDEX_DISK_API_BASE}/public/resources?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(filePath)}`
      } else {
        yandexUrl = `${YANDEX_DISK_API_BASE}/resources?path=${encodeURIComponent(filePath)}`
        headers['Authorization'] = `OAuth ${token}`
      }
      
      const response = await fetch(yandexUrl, { headers })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Yandex API error ${response.status}: ${errorText.substring(0, 200)}`)
      }
      
      const data = await response.json()
      
      // Для публичных папок формируем прямую ссылку для просмотра
      if (publicKey && data.file) {
        // Для файлов в публичной папке используем прямую ссылку
        const viewUrl = `https://disk.yandex.ru/d/${publicKey}${filePath.startsWith('/') ? '' : '/'}${filePath}`
        return new Response(
          JSON.stringify({ view_url: viewUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Для OAuth используем preview или download ссылку
      // Если есть preview - используем его, иначе получаем download ссылку
      if (data.preview) {
        return new Response(
          JSON.stringify({ view_url: data.preview }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Если нет preview, получаем download ссылку для просмотра
      if (publicKey) {
        const publicUrl = `https://disk.yandex.ru/d/${publicKey}`
        const downloadUrl = `${YANDEX_DISK_API_BASE}/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(filePath)}`
        const downloadResponse = await fetch(downloadUrl, { headers: { 'Accept': 'application/json' } })
        if (downloadResponse.ok) {
          const downloadData = await downloadResponse.json()
          return new Response(
            JSON.stringify({ view_url: downloadData.href }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        const downloadUrl = `${YANDEX_DISK_API_BASE}/resources/download?path=${encodeURIComponent(filePath)}`
        const downloadResponse = await fetch(downloadUrl, { 
          headers: { 
            'Authorization': `OAuth ${token}`,
            'Accept': 'application/json' 
          } 
        })
        if (downloadResponse.ok) {
          const downloadData = await downloadResponse.json()
          return new Response(
            JSON.stringify({ view_url: downloadData.href }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      // Fallback: возвращаем путь как есть
      return new Response(
        JSON.stringify({ view_url: filePath }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Неизвестное действие. Используйте: files, download-link, view-link' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Ошибка Edge Function yandex-disk:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Внутренняя ошибка сервера' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
