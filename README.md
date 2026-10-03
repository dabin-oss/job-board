# job-board
프로덕트 디자이너, UX/UI, PM 채용공고를 한 화면에서 보는 개인용 페이지.

- 페이지: `index.html` (GitHub Pages)
- 수집: `scripts/collect.mjs`를 `.github/workflows/collect.yml`이 약 30분마다 실행해 `data/jobs.json`을 갱신
- `data/manual.json`: 직접 열어 확인한 공고
- 사람인 키는 레포 Secrets의 `SARAMIN_KEY`에 넣기 (코드나 파일에 넣지 않기)
