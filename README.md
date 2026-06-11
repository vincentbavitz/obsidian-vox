# Obsidian Vox - Smart Voice Transcription

VOX automatically transcribes the audio notes in your Obsidian vault - extracting metadata, categories and tag information. The transcribed text is then placed into its final direcory with its accompanying metadata (frontmatter) and tags.

![readme_visual_1800](https://github.com/vincentbavitz/obsidian-vox/assets/58160433/10528b09-ab04-49e3-8b24-06457d7abb57)

The *unprocessed* directory is watched for new files; upon discovering a new file it will trigger the transcription and save the file to your vault.

Vox is **fully self-hosted** — transcription runs on your own machine via a local Docker backend. No data leaves your machine, no accounts required, no cost beyond your hardware.

***Please note** that at this moment, the transcription model is fine-tuned for English and may struggle with other languages.*

#### Status View

Open the status panel to see the current status of your transcription queue.

![obsidian-vox-sidebar-example](https://github.com/user-attachments/assets/1291c3c0-7e4e-4c4e-900e-59ad7b8e3c17)




## Motivation

Voice memos are a very convenient and efficient medium to formulate and explicate your ideas. However they suffer from the major drawback that they are not plaintext and cannot be indexed, searched, sorted or categorized.

As your collection of raw voice notes grows, your ability to search through them for important information shrinks. An enormous directory of thousands of audio files is no way to organise our notes. VOX solves this problem by pulling out the important information from your voice notes and intelligently categorizing them (see #Categorization below).


## Instructions

### 1. Set Up the Backend

Vox requires a local backend to perform transcription. Head to [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) and follow the setup instructions there — it runs entirely on your own machine via Docker, so nothing leaves your device.

The short version:

```bash
# CPU (recommended for most users)
docker compose up --build

# GPU — AMD, Intel, or NVIDIA via Vulkan (faster inference)
docker compose -f docker-compose-gpu.yaml up --build
```

The backend starts on **http://localhost:8000** and downloads the Whisper model (~470 MB) on first run.

### 2. Configure the Plugin

1. Enable Vox in Obsidian → Settings → Community Plugins
2. In the Vox settings, set the **Backend URL** to `http://localhost:8000` (the default)
3. Set your **Watch Directory** (default: `Voice/unprocessed`) and **Output Directory** (default: `Voice`)
4. Drop a voice note into your watch directory to verify everything is working

### Example Setups

#### Desktop (simplest)

> - Record a voice memo on your desktop and save it directly into `<Vault>/Voice/unprocessed`
> - The desktop Obsidian plugin picks it up and sends it to the local backend for transcription

#### Mobile → Desktop via Sync

> - Record on your phone using any voice recorder app
> - Sync audio files to your desktop vault's watch folder using [Syncthing](https://syncthing.net/), iCloud, or similar
> - The desktop Obsidian plugin transcribes them automatically

#### Mobile → Desktop via Tailscale (no sync app needed)

> - Install [Tailscale](https://tailscale.com/) on both your phone and the machine running the backend
> - In the Vox plugin settings on your phone's Obsidian app, set the backend URL to your desktop's Tailscale IP: `http://100.x.x.x:8000`
> - Record voice memos on your phone — they are sent directly to your desktop's backend over the encrypted Tailscale tunnel and transcribed there
> - No sync tool required; your vault files still live wherever you keep them


## Categorization
When saving your voice notes, you may prefix the filename with a special categorization token. This allows VOX to organise your voice notes into distinct categories and importance ratings.

For example, you might find that a voice note of your wedding is an importance of 5/5 while a ramble about your work might be a 1/5 in importance. We could categorize these by setting their filenames like so:

- `R5LN Wedding Night With Charlotte.mp3` -> Importance rating of *5/5* in the category of *Life Note*
- `R1RM Ramble about work issues.mp3` -> Importance rating of *1/5* in the category of *Ramble*

See below for a more detailed explanation.

### Importance Rankings

The convention is to prefix your voice memo filename with R{digit} from R1 -> R5 where the digit
is an importance rating between 1 and 5.

Thusly a standard filename is of the following format: `R{importance}{category} {title}.{extension}`

### Voice Memo Categories

Voice memo filenames should be prefixed with their category in order to organise them appropriately.
Here is a list of example categories along with their prefixes...

- LN - Life Note
- IN - Insight
- DR - Dream
- RE - Relationships
- RM - Ramble
- RN - Rant
- PH - Philosophising
- PO - Political

You may set your own categorization map in the settings - the sky's the limit!

## Intelligent Summaries

VOX now includes built-in AI summarization powered by a local LLM (Ollama). Summaries help you quickly understand the essence of your voice notes without reading the full transcript.

### Per-Transcription Summaries

After each voice note is transcribed, VOX can automatically generate a concise summary using your local LLM:

- **Automatic generation**: Enable in settings → transcriptions are summarized on completion
- **Smart linking**: Summary files are automatically linked to their source transcriptions (and vice versa)
- **Custom prompts**: Add your own instructions to the summarization prompt (e.g., "Focus on action items")
- **Non-fatal**: Summarization failures don't affect transcription — your notes are always preserved

### Recurring Summaries (Weekly, Monthly, Yearly)

VOX automatically generates intelligent periodic summaries that synthesize all your voice notes:

- **Weekly summaries**: Overview of notes recorded in each week, organized by your custom categories (e.g., "Life Notes from this Week", "Insights from this Week")
- **Monthly summaries**: Built from weekly summaries to preserve detail while staying within token limits
- **Yearly summaries**: Annual reviews built from monthly summaries

**Smart prerequisites**: The scheduler waits for all lower-level summaries before generating higher-level ones, and respects individual note summarization status.

**Token-aware context hierarchy**: To stay within your LLM's token limit, the system uses:
- Full transcription text for weekly summaries (falls back to note summaries if too large)
- Weekly summaries as context for monthly summaries
- Monthly summaries as context for yearly summaries

### Manual Summary Generation

**Periodic Summaries:**
Use Obsidian commands to manually generate summaries for any period:

- `VOX: Generate Weekly Summary` — choose any completed week
- `VOX: Generate Monthly Summary` — choose any completed month
- `VOX: Generate Yearly Summary` — choose any completed year

Each command opens a modal showing available periods with note counts and readiness status. Existing summaries prompt for confirmation before overwriting.

**Individual Note Summaries:**
Manually summarize individual transcriptions:

- `VOX: Summarize a Note` — opens a modal listing all unsummarized transcriptions; select one to summarize immediately
- `VOX: Summarize All Notes` — queues all unsummarized transcriptions for summarization in sequence

These commands are useful if you prefer to manually control which notes get summarized, or if you want to catch up on a backlog of unsummarized transcriptions.

### Settings

- **Enable Summarization**: Toggle per-transcription summarization on/off
- **Summary Directory**: Where summaries are stored (default: `Voice/Summaries`)
- **Summarization Prompt**: Custom instructions appended to the default summary prompt
- **Weekly/Monthly/Yearly Toggles**: Enable auto-generation for each interval
- **Recurring Summary Prompt**: Custom instructions for periodic summaries (e.g., "Include psychological analysis")

---

## Built-In Audio Recorder

VOX includes a built-in audio recorder directly in Obsidian — no need for external recording apps:

- **Record in-app**: Click the microphone icon in the ribbon to open the recorder
- **Categorize on-the-fly**: Select your voice memo category and importance rating before or after recording
- **Automatic processing**: Recorded audio is automatically placed in your watch directory and transcribed
- **One-click workflow**: Record → categorize → transcribe → summarize — all from within Obsidian

## Roadmap

#### Templates

Allowing users to build their own templates using shortcodes such as `{{ tags }}`, `{{ transcript }}`, `{{ category }}`.

## Self Hosting

See [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for full backend setup, configuration options (model size, GPU inference, environment variables), and troubleshooting.
