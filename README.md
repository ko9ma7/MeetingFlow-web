# MeetingFlow-web

MeetingFlow의 **로컬 우선, 검토 우선** 원칙을 브라우저로 옮긴 정적 웹 서비스입니다.

## 공개 서비스

배포 후 `https://ko9ma7.github.io/MeetingFlow-web/`에서 사용할 수 있습니다.

## 주요 기능

- 브라우저 마이크 녹음과 녹음 파일 내려받기
- 지원 브라우저의 실시간 음성 인식
- 원본을 보존하는 전사 검토 흐름
- 외부 API 없이 동작하는 근거 기반 회의록 초안
- 회의 기록의 브라우저 로컬 저장과 Markdown 내보내기
- 데스크톱·모바일 반응형 UI와 키보드 포커스, 동작 줄이기 설정 지원

## 원본 앱과의 차이

GitHub Pages는 정적 호스팅이므로 Windows 앱의 WASAPI 시스템 오디오 루프백과 Python 기반 로컬 Whisper 정밀 전사는 포함하지 않습니다. 브라우저 음성 인식은 브라우저 제공자 정책에 따라 네트워크에서 처리될 수 있습니다. 민감한 회의에서는 녹음만 사용하고 전사는 직접 입력하세요.

회의 데이터와 검토본은 현재 브라우저의 `localStorage`에만 저장됩니다. 계정 동기화나 서버 전송은 없습니다. 녹음 오디오는 현재 탭에서만 내려받을 수 있으며 페이지를 떠나기 전에 저장해야 합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run qa
```

`npm run qa`는 설치된 Microsoft Edge를 사용해 샘플 회의의 검토, 보고서 생성, 기록 보관 흐름과 390px 모바일 가로 넘침을 확인합니다.

## 배포

검증 후 정적 결과를 `gh-pages` 브랜치에 배포합니다.

```bash
npm test
npm run deploy
```

## 라이선스

[MIT](LICENSE)
