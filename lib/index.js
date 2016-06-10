"use strict";

const BloggifyAdapter = require("bloggify-adapter")
    , mdify = require("mdify")
    ;

module.exports = class BloggifyMarkdownAdapter extends BloggifyAdapter {
    getArticlePath (id) {
        return `${this.paths.articles}/${id}.md`;
    }
    getArticleById (id, cb) {
        mdify.parseFile(this.getArticlePath(id), this.parseOpts, cb);
    }
};
