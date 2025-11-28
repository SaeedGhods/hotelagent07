const { ElevenLabsAPI } = require('@elevenlabs/elevenlabs-js');
const fs = require('fs');
const path = require('path');

const elevenlabs = new ElevenLabsAPI({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// Voice settings - you can customize these
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice ID
const MODEL_ID = 'eleven_monolingual_v1';

// Cache directory for audio files
const AUDIO_CACHE_DIR = path.join(__dirname, '../../audio_cache');

// Ensure cache directory exists
if (!fs.existsSync(AUDIO_CACHE_DIR)) {
  fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

/**
 * Generate speech from text using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Optional voice ID to use
 * @returns {string|null} - URL to the generated audio file or null if failed
 */
async function generateSpeech(text, voiceId = VOICE_ID) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log('ElevenLabs API key not configured, skipping TTS');
      return null;
    }

    // Generate unique filename based on text hash
    const textHash = require('crypto').createHash('md5').update(text).digest('hex');
    const filename = `${textHash}.mp3`;
    const filePath = path.join(AUDIO_CACHE_DIR, filename);

    // Check if we already have this audio cached
    if (fs.existsSync(filePath)) {
      console.log('Using cached audio for:', text.substring(0, 50) + '...');
      return getAudioUrl(filename);
    }

    console.log('Generating speech for:', text.substring(0, 50) + '...');

    // Generate speech using ElevenLabs
    const audioStream = await elevenlabs.generate({
      voice: voiceId,
      text: text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      }
    });

    // Save audio to file
    const buffer = Buffer.from(await audioStream.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log('Speech generated and cached successfully');
    return getAudioUrl(filename);

  } catch (error) {
    console.error('Error generating speech with ElevenLabs:', error);
    return null;
  }
}

/**
 * Get available voices from ElevenLabs
 * @returns {Array} - List of available voices
 */
async function getVoices() {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return [];
    }

    const voices = await elevenlabs.getVoices();
    return voices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [];
  }
}

/**
 * Convert audio file path to accessible URL
 * @param {string} filename - Audio filename
 * @returns {string} - Public URL to access the audio
 */
function getAudioUrl(filename) {
  // In production, this would serve from a CDN or public URL
  // For development, we'll serve from our Express static files
  return `/audio/${filename}`;
}

/**
 * Clean up old cached audio files
 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
 */
function cleanupCache(maxAge = 24 * 60 * 60 * 1000) {
  try {
    const files = fs.readdirSync(AUDIO_CACHE_DIR);
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(AUDIO_CACHE_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up old audio cache file:', file);
      }
    });
  } catch (error) {
    console.error('Error cleaning up audio cache:', error);
  }
}

/**
 * Test ElevenLabs connection
 * @returns {boolean} - True if connection is working
 */
async function testConnection() {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return false;
    }

    const voices = await getVoices();
    return voices.length > 0;
  } catch (error) {
    console.error('ElevenLabs connection test failed:', error);
    return false;
  }
}

module.exports = {
  generateSpeech,
  getVoices,
  cleanupCache,
  testConnection,
  VOICE_ID
};
