# 수집 즉시 실행 중계 서버 (Cloudflare Worker)

1. Cloudflare 대시보드 > Workers & Pages > Create > Worker 만들고 `relay.js` 내용 붙여넣기
2. GitHub > Settings > Developer settings > Fine-grained tokens 에서 `dabin-oss/job-board` 한 레포만 선택, 권한은 Actions: Read and write 하나만
3. Worker > Settings > Variables and Secrets 에 `GH_TOKEN`을 Secret으로 등록 (토큰은 다른 곳에 붙여넣지 않기)
4. Worker 주소를 `index.html`의 `RELAY_URL`에 넣고 푸시
