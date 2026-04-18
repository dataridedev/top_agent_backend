const { S3 } = require('aws-sdk');
const AWS = require('aws-sdk');
    multer = require('multer');
    // var promise = require('promise');

    // #Region-1 Start

var awsConfig = {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: process.env.MAIL_REGION_NODEMAILER
}

const s3 = new AWS.S3(awsConfig)

const uploadToS3 = async (file) => {
    console.log('uploadToS3')
    // let fileExt = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
            if (!file || !file.buffer || !file.originalname) {
                return Promise.reject(new Error("Invalid file data"));
            }

            const sanitizedFilename = file.originalname.replace(/\s+/g, ' '); 
    
            // Extract file extension
            // fileExt = file.originalname.substring(file.originalname.lastIndexOf('.'));
    
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: sanitizedFilename,
            Body: file.buffer
        }
        console.log(params)
        return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
            if (err) {
                console.log('failed at s3.upload function')
                console.log(err)
                reject(err)

            }
            console.log(data)
            data.Location = decodeURIComponent(data.Location);
            return resolve(data)
        })
    })
};
const downloadFromS3 = async (fileUrl) => {
    console.log('downloadFromS3');
    return new Promise((resolve, reject) => {
        try {
            // Parse the S3 file key from the URL
            const bucketName = process.env.AWS_BUCKET_NAME;
            const fileKey = fileUrl.split('/').pop();

            const params = {
                Bucket: bucketName,
                Key: fileKey,
            };

            console.log(params);
            s3.getObject(params, (err, data) => {
                if (err) {
                    console.log('Failed at s3.getObject function');
                    console.log(err);
                    reject(err);
                }
                console.log(data);
                resolve(data.Body);
            });
        } catch (error) {
            console.log('Error parsing fileKey from URL');
            reject(error);
        }
    });
};
const deleteFromS3 = async (fileUrl) => {
    console.log('deleteFromS3');
    return new Promise((resolve, reject) => {
        try {
            // Parse the S3 file key from the URL
            const bucketName = process.env.AWS_BUCKET_NAME;
            const fileKey = fileUrl.split('/').pop();

            const params = {
                Bucket: bucketName,
                Key: fileKey,
            };

            console.log(params);

            // Call S3 deleteObject method
            s3.deleteObject(params, (err, data) => {
                if (err) {
                    console.log('Failed at s3.deleteObject function');
                    console.log(err);
                    reject(err);
                }
                console.log('File deleted successfully:', data);
                resolve({ message: 'File deleted successfully', data });
            });
        } catch (error) {
            console.log('Error parsing fileKey from URL');
            reject(error);
        }
    });
};

module.exports = {  uploadToS3, downloadFromS3, deleteFromS3 }
