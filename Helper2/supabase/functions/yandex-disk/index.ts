// Supabase Edge Function для работы с Яндекс Диском
// Позволяет просматривать файлы и папки без backend сервера

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const YANDEX_DISK_API_BASE = "https://cloud-api.yandex.net/v1/disk"

serve(async (req) => {
  // Обработка CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'files'
    let folderPathParam = url.searchParams.get('folder_path')
    const filePath = url.searchParams.get('file_path') || ''
    
    // Нормализуем путь: убираем префикс "disk:" если есть
    if (folderPathParam && typeof folderPathParam === 'string' && folderPathParam.startsWith('disk:')) {
      folderPathParam = folderPathParam.substring(5)
    }
    
    // Если folder_path не передан или пустой, используем undefined для запроса корня
    let folderPath = folderPathParam && folderPathParam.trim() && folderPathParam !== '/' 
      ? folderPathParam.trim() 
      : undefined
    
    console.log('=== REQUEST PARAMS ===')
    console.log('action:', action)
    console.log('folder_path param (raw):', url.searchParams.get('folder_path'))
    console.log('folder_path param (normalized):', folderPathParam)
    console.log('folderPath (final):', folderPath || '(undefined - корень)')
    
    // Получаем секреты из переменных окружения Supabase
    // Пробуем разные способы доступа к секретам
    const publicKey = Deno.env.get('YANDEX_DISK_PUBLIC_KEY') || 
                      Deno.env.get('YANDEX_DISK_PUBLIC_KEY') ||
                      (Deno.env.toObject && Deno.env.toObject()['YANDEX_DISK_PUBLIC_KEY'])
    const token = Deno.env.get('YANDEX_DISK_TOKEN') || 
                  (Deno.env.toObject && Deno.env.toObject()['YANDEX_DISK_TOKEN'])
    
    // Отладочная информация
    console.log('=== YANDEX DISK EDGE FUNCTION DEBUG ===')
    console.log('Action:', action)
    console.log('Folder path:', folderPath)
    console.log('File path:', filePath)
    console.log('Has publicKey:', !!publicKey)
    console.log('PublicKey length:', publicKey?.length || 0)
    console.log('PublicKey first chars:', publicKey ? publicKey.substring(0, Math.min(15, publicKey.length)) : 'null')
    console.log('Has token:', !!token)
    console.log('All env keys:', Object.keys(Deno.env.toObject ? Deno.env.toObject() : {}).filter(k => k.includes('YANDEX')))
    
    if (!publicKey && !token) {
      console.error('ERROR: No secrets found!')
      console.error('Available env vars:', Object.keys(Deno.env.toObject ? Deno.env.toObject() : {}).slice(0, 10))
      return new Response(
        JSON.stringify({ 
          error: 'YANDEX_DISK_PUBLIC_KEY или YANDEX_DISK_TOKEN не настроены в Supabase Secrets. Проверьте настройки в Dashboard → Settings → Edge Functions → Secrets. Секрет должен быть добавлен для Edge Functions, а не для проекта.' 
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
      
      if (publicKey && publicKey.trim()) {
        // Публичная папка
        // ВАЖНО: API требует полную ссылку, а не только ключ!
        const publicUrl = `https://disk.yandex.ru/d/${publicKey.trim()}`
        console.log('=== FILES ACTION DEBUG ===')
        console.log('Public key from env:', publicKey ? publicKey.substring(0, 20) + '...' : 'null')
        console.log('Public URL:', publicUrl)
        
        // Формируем URL вручную с правильным кодированием (как в рабочем варианте)
        const baseUrl = `${YANDEX_DISK_API_BASE}/public/resources`
        
        // ВАЖНО: Используем encodeURIComponent для каждого параметра отдельно
        // Это гарантирует правильное кодирование кириллицы и пробелов
        let yandexUrl = `${baseUrl}?public_key=${encodeURIComponent(publicUrl)}&limit=10000`
        
        // ВАЖНО: Если folderPath undefined или пустой, НЕ добавляем параметр path
        // Это запросит корень публичной папки (все папки на верхнем уровне)
        // Для публичных папок путь должен быть относительным к корню публичной папки
        // Например: если корень "Вишневый_сад-3_для_Заказчика", а путь "/Вишневый_сад-3_для_Заказчика/1. РД"
        // то для API передаем только "1. РД"
        if (folderPath && folderPath !== '/') {
          // Нормализуем путь: убираем префикс "disk:" и начальный слеш
          let normalizedPath = String(folderPath || '').trim()
          
          if (normalizedPath) {
            // Убираем префикс "disk:" если есть
            if (normalizedPath.startsWith('disk:')) {
              normalizedPath = normalizedPath.substring(5).trim()
            }
            
            // Убираем начальный слеш
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1).trim()
            }
            
            // Если путь не пустой после нормализации, добавляем его к URL
            if (normalizedPath) {
              // ВАЖНО: Используем encodeURIComponent для правильного кодирования кириллицы и пробелов
              yandexUrl += `&path=${encodeURIComponent(normalizedPath)}`
              
              console.log('Original folder path:', folderPath)
              console.log('Normalized path for API:', normalizedPath)
              console.log('Encoded path:', encodeURIComponent(normalizedPath))
            }
          }
        } else {
          console.log('No folder path - requesting ROOT (корень публичной папки)')
        }
        
        console.log('Final Yandex URL:', yandexUrl ? yandexUrl.substring(0, 500) : 'undefined')
        console.log('URL contains public_key:', yandexUrl ? yandexUrl.includes('public_key') : false)
        console.log('URL contains path:', yandexUrl ? yandexUrl.includes('path=') : false)
      } else {
        console.error('ERROR: publicKey is empty or null!')
        console.error('publicKey value:', publicKey)
        console.error('publicKey type:', typeof publicKey)
        
        // OAuth токен (fallback)
        if (!token) {
          return new Response(
            JSON.stringify({ 
              error: 'YANDEX_DISK_PUBLIC_KEY не настроен или пуст. Проверьте значение секрета в Dashboard → Settings → Edge Functions → Secrets' 
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        const path = folderPath || '/'
        yandexUrl = `${YANDEX_DISK_API_BASE}/resources?path=${encodeURIComponent(path)}&limit=10000`
        headers['Authorization'] = `OAuth ${token}`
      }
      
      console.log('Making request to Yandex API...')
      console.log('URL:', yandexUrl.substring(0, 200))
      const response = await fetch(yandexUrl, { headers })
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Yandex API error ${response.status}:`, errorText)
        console.error('Request URL was:', yandexUrl)
        throw new Error(`Yandex API error ${response.status}: ${errorText.substring(0, 200)}`)
      }
      
      const data = await response.json()
      const items = data._embedded?.items || []
      
      // Определяем корневую папку публичной папки из ответа API
      // Это путь корневой папки, например "disk:/Вишневый_сад-3_для_Заказчика"
      const rootPathFromResponse = data.path || ''
      let rootFolderPath = ''
      if (rootPathFromResponse.startsWith('disk:')) {
        rootFolderPath = rootPathFromResponse.substring(5) // Убираем "disk:"
      } else {
        rootFolderPath = rootPathFromResponse
      }
      
      // Убираем начальный слеш
      if (rootFolderPath.startsWith('/')) {
        rootFolderPath = rootFolderPath.substring(1)
      }
      
      console.log('=== RESPONSE DATA ===')
      console.log('Root path from API:', rootPathFromResponse)
      console.log('Root folder path (normalized):', rootFolderPath)
      console.log('Total items received:', items.length)
      if (items.length > 0) {
        console.log('First item sample:', {
          name: items[0].name,
          type: items[0].type,
          path: items[0].path
        })
      }
      
      // Форматируем данные для frontend
      const formattedItems = items.map((item: any) => {
        // Путь от Яндекс API в формате "disk:/путь/к/файлу"
        const fullPath = item.path || ''
        
        // Вычисляем относительный путь от корня публичной папки
        let relativePath = fullPath
        
        // Убираем префикс "disk:" если есть
        if (relativePath.startsWith('disk:')) {
          relativePath = relativePath.substring(5)
        }
        
        // Убираем начальный слеш
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1)
        }
        
        // Если путь начинается с корневой папки публичной папки, убираем её
        if (rootFolderPath && relativePath.startsWith(`${rootFolderPath}/`)) {
          relativePath = relativePath.substring(rootFolderPath.length + 1) // +1 для слеша
        } else if (relativePath === rootFolderPath) {
          // Если это сама корневая папка, относительный путь пустой
          relativePath = ''
        }
        
        return {
          name: item.name,
          path: fullPath, // Полный путь для отображения и навигации
          relativePath: relativePath || item.name, // Относительный путь для запросов к API
          type: item.type,
          size: item.size || 0,
          mime_type: item.mime_type || '',
          modified: item.modified,
          created: item.created,
          preview: item.preview || '',
          public_url: item.public_url || '', // Прямая публичная ссылка (если есть)
          public_key: publicKey
        }
      })
      
      console.log('Formatted items count:', formattedItems.length)
      if (formattedItems.length > 0) {
        console.log('Sample formatted item:', formattedItems[0])
      }
      
      return new Response(
        JSON.stringify({
          files: formattedItems,
          total: formattedItems.length,
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
        const urlParams = new URLSearchParams({
          'public_key': publicUrl,
          'path': filePath
        })
        yandexUrl = `${YANDEX_DISK_API_BASE}/public/resources/download?${urlParams.toString()}`
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
        const urlParams = new URLSearchParams({
          'public_key': publicUrl,
          'path': filePath
        })
        yandexUrl = `${YANDEX_DISK_API_BASE}/public/resources?${urlParams.toString()}`
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
        const downloadParams = new URLSearchParams({
          'public_key': publicUrl,
          'path': filePath
        })
        const downloadUrl = `${YANDEX_DISK_API_BASE}/public/resources/download?${downloadParams.toString()}`
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
