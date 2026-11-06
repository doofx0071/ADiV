# Windows setup — T3 Code with two providers

## Install or update
Open **Windows PowerShell**:

```powershell
winget install T3Tools.T3Code
```

If already installed, use T3's app update feature or the official release: https://github.com/pingdotgg/t3code/releases

## Connect Codex (one account)
1. Open T3 Code > Settings > Providers. Select the Windows environment where your project runs.
2. Select Codex > **Connect with ChatGPT**.
3. Sign in to **one** ChatGPT Plus account. Wait until Codex is authenticated and lists available models.
4. If this is a revision from a multi-account setup, remove or disable other Codex provider instances from T3 after closing any running tasks on them. Do not delete CLI login files blindly.

## Connect Google Antigravity (one account)
1. Still under Settings > Providers in that environment, find **Antigravity**.
2. Enable the provider, choose **Install Antigravity**, and then choose **Sign in**.
3. Use the **Google account** method and sign in with your Google AI Pro account.
4. Wait for T3 to confirm access and load the advertised model list. Authentication in the separate Antigravity IDE does not substitute for this step.
5. Do not select a Gemini API key or GCP billing method unless you explicitly want separate API billing.

## Project configuration
1. Open an **existing** Git project in T3 Code. Preserve its current files.
2. Set Settings > General > New threads > Permissions = **Supervised**; the project can override this default.
3. In the project root, if `AGENTS.md` does not exist, copy `AGENTS.example.md` to `AGENTS.md`. Otherwise merge relevant rules into the existing file.
4. Create a thread using **Codex** as lead. Choose a model actually advertised by your account.
5. Paste the complete contents of `orchestration/LEAD-PROMPT.md` as the first message.
6. Run `orchestration/SMOKE-TEST.md` before allowing edits.

## Important behavior
- No third-party API key required for the two supported subscription sign-ins.
- There is no universal automatic model-routing toggle; the lead chooses a provider/model for each delegated task.
- `delegate_task` creates a child task but does **not** promise an isolated Git worktree. For parallel **writes**, use explicitly separate worktree-backed threads (`t3_thread_launch` with worktree strategy) or serialize edits.
- Two logical workers on Codex still consume the **same** account's allowance. Use Google as the second provider and avoid quota-bypassing rotation.
