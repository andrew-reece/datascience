# load packages
require(reshape)
require(reshape2)
# setwd
setwd("~/gdrive/Coursework/171/cs171-final-project/data")
# load data
df <- read.csv('RelationshipsFromSurveys.csv')
# format df
df <- df[!(df$id.A==df$id.B),] # no self-relationships
df$id <- 1:nrow(df) # create index column
df$pairs <- paste0(df$id.A,'-',df$id.B) # create pairwise column
# make wide df
df.wide <- dcast(df[,c(5,6,4,3)], id + pairs ~ survey.date, value = 'relationship')
# write to csv (see relationships-munge.py for next steps)
write.csv(df.wide, 'relationships2.csv')