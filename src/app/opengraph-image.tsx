import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '모여유 - 친구들과 일정을 맞춰봐요'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fff0f6 0%, #fce7f3 50%, #fdf2f8 100%)',
          position: 'relative',
        }}
      >
        {/* 배경 원 장식 */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(244, 114, 182, 0.12)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(244, 114, 182, 0.08)',
            display: 'flex',
          }}
        />

        {/* 메인 카드 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            borderRadius: 40,
            padding: '64px 80px',
            boxShadow: '0 8px 60px rgba(244, 114, 182, 0.15)',
            gap: 24,
          }}
        >
          {/* 아이콘 + 타이틀 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: 'linear-gradient(135deg, #f472b6, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
              }}
            >
              📅
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 800,
                color: '#f472b6',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}
            >
              모여유
            </div>
          </div>

          {/* 서브타이틀 */}
          <div
            style={{
              fontSize: 32,
              color: '#9ca3af',
              fontWeight: 400,
              letterSpacing: '0.5px',
            }}
          >
            친구들과 일정을 맞춰봐요
          </div>

          {/* 태그들 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {['날짜 조율', '친구와 공유', '약속 확정'].map((tag) => (
              <div
                key={tag}
                style={{
                  background: '#fdf2f8',
                  border: '1.5px solid #fbcfe8',
                  borderRadius: 100,
                  padding: '10px 24px',
                  fontSize: 22,
                  color: '#f472b6',
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
