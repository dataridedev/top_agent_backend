'use strict';
const adminService = require('../services/admin.service');
const { success, paginated, created } = require('../utils/response');

// const createBadges = async (req, res, next) => {
//   try {
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({
//         success: false,
//         message: 'Badge icon is required'
//       });
//     }

//     const badgeData = {
//       ...req.body,  badge_icon: file.originalname 
//     };

    
//     const badge = await adminService.createdBadges(badgeData);

//     return res.status(201).json({
//       success: true,
//       data: badge
//     });
//   } catch (err) {
//     next(err);
//   }
// };

const createBadges = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Badge icon is required"
      });
    }

    const badge = await adminService.createdBadges({
      ...req.body,
      file: req.file
    });

    return res.status(201).json({
      success: true,
      data: badge
    });
  } catch (err) {
    next(err);
  }
};



module.exports = {
  createBadges,
};