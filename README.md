# 수업 AI 도우미

바탕화면의 **수업 AI 도우미 - 로컬 실행** 바로가기를 더블클릭합니다. Windows와 Node.js 20 이상이 필요합니다. 바로가기가 없다면 프로젝트 폴더의 PowerShell에서 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\start-local.ps1 -Choice 1
```

처음에는 OpenAI API 키를 숨김 입력으로 받습니다. 앱은 [GitHub Pages](https://aqurius-code.github.io/class-ai-helper/)에서 열리고, AI 요청은 이 PC의 로컬 서버를 거칩니다. Chrome이 로컬 네트워크 접근 확인을 표시하면 앱 사용을 위해 허용하세요. 로컬 화면은 [127.0.0.1:8787](http://127.0.0.1:8787)에서도 열 수 있습니다.

시연이 끝나면 **수업 AI 도우미 - 로컬 API 키 삭제** 바로가기를 클릭합니다. 암호화된 키 파일이 삭제되고, 해당 키로 열린 로컬 서버가 연결을 종료합니다. 바로가기 없이 삭제하려면 같은 명령의 `-Choice 3`을 사용합니다. OpenAI 계정에서 키를 폐기하려면 OpenAI Platform에서 해당 키를 폐기해야 합니다.

자료 읽기 입력란을 클릭하고 스크린샷을 붙여넣은 뒤 **분석 시작**을 누르세요.
