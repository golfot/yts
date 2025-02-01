import 'dotenv/config'
import { GoogleAIFileManager } from "@google/generative-ai/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'; // Import sharp

const genAI = new GoogleGenerativeAI(process.env.API_KEY)

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
const fileManager = new GoogleAIFileManager(process.env.API_KEY)

export async function describeImage(img) {
    if (!img || !img.path)
        throw new Error("Image file name required.")

    const tempPath = path.join('/tmp', path.basename(img.path))
    const compressedPath = path.join('/tmp', `compressed_${path.basename(img.path)}`);

    try {
        console.log('Compressing image:', img.path); // Log sebelum kompresi
        await sharp(img.path)
            .resize({ width: 800 }) // Ubah ukuran jika perlu
            .jpeg({ quality: 50 }) // Atur kualitas untuk kompresi
            .toFile(compressedPath);
        console.log('Image compressed successfully:', compressedPath); // Log setelah kompresi
        const stats = fs.statSync(compressedPath);
        console.log(`Compressed file size: ${stats.size / 1024} KB`); // Log ukuran file dalam KB
    } catch (error) {
        console.error('Error during image compression:', error); // Log error kompresi
        throw error;
    }

    try {
        const uploadResult = await fileManager.uploadFile(compressedPath, {
            mimeType: img.mimetype,
            displayName: "Image",
        })

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            { text: "Describe the image with a general explanation. If the image contains a question, identify the type of question and provide the appropriate answer according to the context, such as math, physics, or other subjects" },
        ])

        // delete image from cloud
        await fileManager.deleteFile(uploadResult.file.name)

        console.log(`Deleted ${uploadResult.file.displayName} from cloud`)

        const response = await result.response
        return response.text()
    } finally {
        // Clean up temporary files
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
        }
        if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath)
        }
    }
}

export async function getRoast(img = '') {
    try {
        console.log('Processing image:', img); // Log informasi gambar
        const imageDesc = await describeImage(img);
        console.log('Image description:', imageDesc); // Log deskripsi gambar
        const prompt = `Analisis gambar berikut dan ekstrak dari teks yang ada. Berikan jawaban terbaik berdasarkan konteks dan Buatkan 10 judul video shorts yang mencolok dan menarik perhatian agar penonton tertarik untuk menontonnya. Setiap judul harus maksimal 50 huruf dan dilengkapi dengan emoticon untuk memperkuat daya tariknya.
        
        ${imageDesc}
    `

        const result = await model.generateContent(prompt)

        const response = await result.response
        const text = response.text()

        return text
    } catch (error) {
        console.error('Error in getRoast:', error); // Log error
        if (fs.existsSync(img.path)) {
            fs.unlinkSync(img.path)
        }

        throw error
    }
}
