import express from 'express';
import bodyParser from "body-parser";
import path, { parse } from 'path';
import { fileURLToPath } from "url";
import fs, { write } from 'fs';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
let port = 5500;

app.use(express.static(path.resolve("./public")));
app.use(bodyParser.urlencoded({extended: true}));


// Blog Utility Operations

const blogFilePath = path.join(__dirname, "blogs.json");

// function to read blogs
function readBlogs() {
    try {
        let data = fs.readFileSync(blogFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.log("Error reading data: ",error);
        return {lastId: 0, blogs: []};
    }
}

// function to write blogs in blog.json
function writeBlogs(data) {
    try{
        fs.writeFileSync(blogFilePath, JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.log("error writing to file:", err);
    }
}

// function to add a new blog post
export const addBlog = (title, description, banner) => {
    let data = readBlogs(); // Get existing blogs data
    let newId = data.lastId + 1; // Generate new ID for the blog
  
    // Create new blog object
    const newBlog = {
      id: newId,
      title: title,
      description: description,
      banner: banner,
      date: new Date().toISOString(), // Store date as ISO string
    };
  
    // Add new blog to the blogs array
    data.blogs.push(newBlog);
  
    // Update lastId in data
    data.lastId = newId;
  
    // Write updated blogs data back to JSON file
    writeBlogs(data);
  };

//   function to delete blog and its banner from uploads folder
  function deleteBlog(id) {
    let blogId = parseInt(id,10);
    let blogs = readBlogs().blogs;
    let blogIndex = blogs.findIndex(b => b.id === blogId);
    console.log(`Blog Id: ${blogId}, BlogIndex: ${blogIndex}, blogs: ${blogs}`);
    if(blogIndex !== -1) {
        console.log(`${blogs[blogIndex].banner}`)
        fs.unlink(`./public/uploads/${blogs[blogIndex].banner}`, (err) =>{
            if(err) {console.error(err);}
            else {console.log("Blog Banner was deleted.");}
        });
        blogs.splice(blogIndex, 1);
        writeBlogs({lastId: readBlogs().lastId, blogs})
        console.log("Blog was deleted.");
    }
    else {
        console.log("Blog not found. Try again.")
    }
  }

// Multer for file operations
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix)
  }
})

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/png', 'image/gif', 'image/jpeg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only jpeg, gif,png allowed"))
    }
}

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
})

// find blog: for viewblog and edit blog

const findBlog = (id) => {
    let blogId = parseInt(id, 10); // ten shows this is a decimal based number system
    let blogs = readBlogs().blogs;
    let blog = blogs.find(b => b.id === blogId);
    return blog;
}


// Way to Pages
app.get("/", (req,res) => {
    let blogData = readBlogs();
    // sort method takes a compare function to sort. To sort in decreasing order, here we are subtracting two blogs date and if the result is -ve that implies that the second blog is newer that first one so it will be placed first. eg 1999-2000 = -1. So 2000 will be placed first. 
    let latestBlogs = blogData.blogs.sort((a,b) => { new Date(a.date) - new Date(b.date)}).slice(0,4);
    res.render("index.ejs", {"page" : "home", "title": "Home", "featurePost" :latestBlogs });
})

app.get("/about", (req,res) => {
    res.render("about.ejs", {"page" : "about", "title": "About Us"});
})

app.get("/blogs", (req,res) => {
    let blogData = readBlogs();
    res.render("blogs.ejs", {"page" : "blogs", "title": "Blogs", "blogData":blogData });
})

app.get("/contact", (req,res) => {
    res.render("contact.ejs", {"page" : "contact", "title": "Contact"});
})

//Way to operation routes (create, edit, delete, read)

app.get("/create-blog", (req, res) => {
    res.render("create-blog.ejs", {"title": "Create Blog", "page":"Create Blog"});
})
app.post("/create-blog", upload.single('banner_image'), (req, res) => {
    let { blog_title, blog_description } = req.body;
    let banner_image = req.file.filename; // Initialize banner_image here
    console.log("Banner Image URL: ", banner_image); // Now this will work
    console.log("Title: ", blog_title);
    console.log("Description: ", blog_description);
  
    addBlog(blog_title, blog_description, banner_image);
    res.send('<script>alert("Blog published successfully!"); window.location.href = "/blogs";</script>'); // Redirect to the blog page after saving
  });

//   view blog
app.get("/blog/:id-:title", (req, res) => {
    let blog = findBlog(req.params.id);
    if (blog) {
        res.render("viewBlog.ejs", { "page": "View Blog", "title": `View Blog - ${blog.title}`, "blog": blog });
    } else {
        res.status(404).send('Blog not found');
    }

    console.log(`${req.params.id} , ${blog}`);
});

// edit blog
app.get("/edit/:id-:title", (req,res) => {
    let blog = findBlog(req.params.id);
    if(blog) {
        res.render("editBlog.ejs", {
            "blogEdit": blog,
            "page": "View Blog", 
            "title": `View Blog - ${blog.title}`
        })
    } else {
        res.status(404).send("<h1 class='text-warning'>Blog not found</h1>")
    }
    console.log("BlogID", req,params);
})

app.post("/edit/:id-:title",upload.single("banner_image"), (req, res) => {
    // res.send(`<h3>resources gained:</h3> <p>${JSON.stringify(req.body)}</p> ` );

    // processing the data recieved in variables.
    let { blog_title, blog_description } = req.body;
    let currentBanner = req.body.current_banner;
    let blogID = parseInt(req.params.id, 10);

    // if no new file is recieved then let the previous one stay.
    let bannerImage = req.file ? req.file.filename : currentBanner;

    let blogs = readBlogs().blogs;

    let blogIndex = blogs.findIndex(b => b.id === blogID) ;

    if(blogIndex !== -1) {
        blogs[blogIndex].title = blog_title;
        blogs[blogIndex].description = blog_description;
        blogs[blogIndex].banner = bannerImage;
        blogs[blogIndex].date = new Date().toISOString(); // time of updation

        // write blogs updation in the blog.json
        writeBlogs({lastId: readBlogs().lastId, blogs});
        res.redirect(`/blog/${blogID}-${blog_title.replace(/ /g, '__')}`)
     } //else {
    //     res.status(404).send("<h2 class='text-warning'>Something went wrong. Please try again</h2>")
    // }

})

app.get("/delete/:id-:title", (req,res) => {
    deleteBlog(req.params.id)
    res.send('<script>alert("Blog deleted successfully!"); window.location.href = "/blogs";</script>'); // Redirect to the blog page after saving

    
})

app.listen(port, () => {
    console.log("Listening at ",port);
    // console.log(__dirname);
})

