import express from "express";
import Team from "../models/teams.js";
import User from "../models/users.js";
import DirectMessage from "../models/directmessage.js";
import Message from "../models/messages.js";
import UserTeam from "../models/userteam.js"
import { checkUser } from "./auth.js";
import { Op } from "sequelize";

const router = express.Router();

//!logout user
router.get("/teams/logout", (req, res) => {
  res.clearCookie("jsonwebtoken");
  res.redirect("/api/auth/login");
});

//!main menu
router.get("/", checkUser, (req, res) => {
  if (!res.locals.user) {
    return res.redirect("/api/auth/login");
  }
  const userId = res.locals.user.id;
  return res.render('dashboard.ejs', { userId });
});


//!create Team
router.post('/createteam', checkUser, async (req, res) => {
  const { name } = req.body;
  const user_id = res.locals.user.id; 
  try {
    const existingTeam = await Team.findOne({ where: { name: name } });
    if (existingTeam) {
      return res.status(400).json({ error: "Team already exists" });
    }
    const existingTeams = await Team.findAll({ attributes: ['id'] });
    const existingIds = existingTeams.map(user => user.id);
    let nextId = 1;
    while (existingIds.includes(nextId)) {
      nextId++;
    }

    const newTeam = await Team.create({ id: nextId, name: name, admin_id: user_id });
    await UserTeam.create({ userid: user_id, teamid: newTeam.id });
    await User.update({ isadmin: true }, { where: { id: user_id } });
    
    return res.redirect('/api/dash' );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get('/createteam', checkUser, (req, res) => {
  return res.render('createteam.ejs');
})



//!Create Message
router.post("/teams/:teamId/messages", checkUser, async (req, res) => {
    const { content } = req.body;
    const { teamId } = req.params;
    const userId = res.locals.user.id; 
    try {

      const isMember = await UserTeam.findOne({
        where: { teamid: teamId, userid: userId }
      });
  
      if (!isMember) {
        return res.status(401).json({ error: "You are not a member of this team" });
      }
      const existingMessages = await Message.findAll({ attributes: ['id'] });
        const existingIds = existingMessages.map(user => user.id);
        let nextId = 1;
        while (existingIds.includes(nextId)) {
            nextId++;
        }
        const sender = await User.findOne({
          where: { id: userId },
          attributes: ['nickname']
        })
      const newMessage = await Message.create({
        id: nextId,
        content,
        user_id: userId, 
        team_id: teamId,
        sendername: sender.nickname,
      });
      
      return res.redirect(`/api/dash/teams/${teamId}/messages`);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
//!Get team by ID
router.get("/teams", checkUser, async (req, res) => {
  try {
    const teams = await Team.findAll({
      attributes: [
        "id",
        "name",
        "admin_id",
        "created_at",
        "updated_at",
      ],
    });

    return res.json(teams);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// router.get("/teams/:teamId/:messageId", checkUser, async (req, res) => {
//   const { teamId, messageId } = req.params;
//   const userId = req.user.id;
//   try {
//     const isMember = await UserTeam.findOne({
//         where: { teamid: teamId, userid: userId }
//       });
  
//       if (!isMember) {
//         return res.status(401).json({ error: "You are not a member of this team" });
//       }
//     const message = await Message.findOne({
//       where: { team_id: teamId, id: messageId },
//     });

//     if (!message) {
//       return res.status(404).json({ error: "Message not found" });
//     }

//     return res.json(message);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

//!Get message by team_id and message_id
router.get("/teams/:teamId/messages", checkUser, async (req, res) => {
  const { teamId } = req.params;
  const userId = res.locals.user.id;
  const user = res.locals.user;
  const team = await Team.findOne({where: { id: teamId}});
  const page = parseInt(req.query.page) || 1; 
  const pageSize = parseInt(req.query.pageSize) || 3; 

  try {
    const isMember = await UserTeam.findOne({
      where: { team_id: teamId, user_id: userId }
    });

    if (!isMember) {
      return res.status(401).json({ error: "You are not a member of this team" });
    }

    const messages = await Message.findAndCountAll({
      where: { team_id: teamId },
      attributes: [
        "id",
        "content",
        "created_at",
        "updated_at",
        "user_id",
        "team_id",
        "sendername",
      ],
      order: [["created_at", "DESC"]], 
      offset: (page - 1) * pageSize, 
      limit: pageSize,
    });

    const totalPages = Math.ceil(messages.count / pageSize);
    return res.render('teams.ejs',{
      user : user,
      team: team,
      messages: messages.rows,
      totalMessages: messages.count,
      totalPages: totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


//! Edit message
router.patch("/teams/:teamId/:messageId", checkUser, async (req, res) => {
  const { teamId, messageId } = req.params;
  const { content } = req.body;
  const userId = res.locals.user.id;
  const team = await Team.findOne({where: { id: teamId}});



  try {
    const message = await Message.findOne({
      where: { team_id: teamId, id: messageId },
    })
    

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }


    if (team.admin_id!==userId&&message.user_id !== userId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to edit this message" });
    }

    message.content = content;
    await message.save();
    return res.redirect(`/api/dash/teams/${teamId}/messages`)
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!Delete message
router.delete("/teams/:teamId/:messageId", checkUser, async (req, res) => {
  const { teamId, messageId } = req.params;
  const userId = res.locals.user.id;
  const team = await Team.findOne({where: { id: teamId}})
  try {
    const message = await Message.findOne({
      where: { team_id: teamId, id: messageId },
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (team.admin_id!==userId&&message.user_id !== userId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to edit this message" });
    }
    await message.destroy();
    return res.redirect(`/api/dash/teams/${teamId}/messages`);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!admin can delete a message
router.delete("/teams/:teamId/:messageId", checkUser, async (req, res) => {
  const { teamId, messageId } = req.params;
  const userId = req.user.id;
  try {
    const message = await Message.findOne({
      where: { team_id: teamId, id: messageId },
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    const team = await Team.findByPk(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    if (team.admin_id !== userId) {
      return res
        .status(401)
        .json({ error: "You're not the coach of this Team" });
    }
    await message.destroy();
    return res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!admin can edit a message
router.put("/teams/:teamId/:messageId", checkUser, async (req, res) => {
  const { teamId, messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  try {
    const message = await Message.findOne({
      where: { team_id: teamId, id: messageId },
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    const team = await Team.findByPk(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    if (team.admin_id !== userId) {
      return res
        .status(401)
        .json({ error: "You're not the coach of this Team" });
    }
    message.content = content;
    await message.save();
    return res.status(200).json({ message: "Message updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!admin can delete a team
router.delete("/teams/:teamId", checkUser, async (req, res) => {
  const { teamId } = req.params;
  const userId = res.locals.user.id;

  try {
    const team = await Team.findOne({ where: { id: teamId } });;

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (team.admin_id !== userId) {
      return res
        .status(401)
        .json({ error: "You're not the coach of this Team" });
    }
    await Message.destroy({ where: { team_id: teamId } }); 
    await Team.destroy({ where: { id: teamId } });

    return res.redirect('/api/dash' );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!pagination system
const lastRequestedPage = {};
router.get("/messages/:teamId", checkUser, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;

  const lastPage = lastRequestedPage[userId] || 1;
  const currentPage = parseInt(req.query.page) || lastPage;
  lastRequestedPage[userId] = currentPage + 1;
  const pageSize = parseInt(req.query.pageSize) || 3;

  try {
    const messages = await Message.findAndCountAll({
      where: { team_id: teamId },
      attributes: [
        "id",
        "content",
        "created_at",
        "updated_at",
        "user_id",
        "team_id",
      ],
      offset: (currentPage - 1) * pageSize,
      limit: pageSize,
    });

    const totalPages = Math.ceil(messages.count / pageSize);

    return res.json({
      messages: messages.rows,
      totalMessages: messages.count,
      totalPages: totalPages,
      currentPage: currentPage,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!sending direct messages
router.post("/direct-messages", checkUser, async (req, res) => {
  const { content, receivername } = req.body;
  const senderId = res.locals.user.id;
  const receiver = await User.findOne({
    where: { nickname: receivername },
    attributes: ['id']
  });
  const sender = await User.findOne({
    where: { id: senderId },
    attributes: ['nickname']
  })

  try {
    const directMessage = await DirectMessage.create({
      content,
      senderId,
      receiverId:receiver.id,
      sendername: sender.nickname,
      receivername,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.redirect('/api/dash/direct-messages/messages');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/direct-messages/messages/", checkUser, async (req, res) => {
  const userId = res.locals.user.id;
  const page = parseInt(req.query.page) || 1; 
  const pageSize = parseInt(req.query.pageSize) || 3; 
  const user = await User.findOne({where: { Id: userId}})
  try {
    
    const directmessage = await DirectMessage.findAndCountAll({
      where: {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      attributes: [
        "id",
        "content",
        "created_at",
        "updated_at",
        "senderId",
        "receiverid",
        "sendername",
        "receivername",
      ],
      order: [["created_at", "DESC"]], 
      offset: (page - 1) * pageSize, 
      limit: pageSize,
    });


    const totalPages = Math.ceil(directmessage.count / pageSize);
    return res.render('direct-messages.ejs',{
      user : user,
      messages: directmessage.rows,
      totalMessages: directmessage.count,
      totalPages: totalPages,
      currentPage: page });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
});


//!edit direct message
router.patch("/direct-messages/messages/:messageId", checkUser, async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = res.locals.user.id;
  const user = await Team.findOne({where: { id: userId}});

  try {
    const message = await DirectMessage.findOne({
      where: { id: messageId },
    })
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId!==userId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to edit this message" });
    }
    
    message.content = content;
    await message.save();
    return res.redirect(`/api/dash/direct-messages/messages`)
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!delete direct messages
router.delete("/direct-messages/messages/:messageId", checkUser, async (req, res) => {
  const { messageId } = req.params;
  const userId = res.locals.user.id;
  try {
    const message = await DirectMessage.findOne({
      where: { id: messageId },
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.senderId !== userId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to edit this message" });
    }
    await message.destroy();
    return res.redirect(`/api/dash/direct-messages/messages`);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//!add user for admin
router.post("/addUser/:teamId", async (req, res) => {
    const { teamId } = req.params;
    const { email } = req.body;
    const userId = res.locals.user.id;
    
    try {
      const team = await Team.findOne({ where: { id: teamId } });
      if (!team || team.admin_id !== userId) {
        return res.status(403).json({ error: "Unauthorized - Only team admins can add users to their team" });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (!existingUser) {
        return res.status(400).json({ error: "User with the provided email does not exist" });
      }

      await UserTeam.create({ teamid: teamId, userid: existingUser.id });
      return res.status(201).redirect(`/api/dash/teams/${teamId}/messages`);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

export default router;
