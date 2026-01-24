Rocky
rockywearsahat
Online

Rocky — 1/2/26, 11:28 AM
Hello Man, I have a quick guide for the bot for you, it has some features I believe you will find helpful
Man — 1/2/26, 11:38 AM
Rocky — 1/2/26, 11:54 AM
The github page (with a front "README" file that is kinda an instruction manual)

https://github.com/RockyWearsAHat/clash-royale-bot

Just scroll down a bit and all the features are listed, but more for coders/people who may want to further develop the code.

In summary

You have access to different commands in each channel, each command is typed /command only the command in the chatbox and then you send the message to that channel to get the response to the command. The response is only visible to you normally but certain commands also have a "post publically" button at the end of the response so you can share it in the channel.
GitHub
GitHub - RockyWearsAHat/clash-royale-bot: A bot for clash royale pr...
A bot for clash royale profile linking, stats & clan war tracking/notifications - RockyWearsAHat/clash-royale-bot
GitHub - RockyWearsAHat/clash-royale-bot: A bot for clash royale pr...
Rocky — 1/2/26, 12:03 PM
Here are the commands you have, in #general (I will label all "channels" with a #) you have the /stats command, this simply pulls your stats or you can specify a name afterwards to get the stats of someone in the clan (autocorrected/referenced to closest mostly match) or a tag to get anyone's stats (not super useful but you can flex)
These can be posted publically
The more helpful commands you have access to are in the #war-logs channel
You can use /warlogs or /warstats to pull the warlogs/stats of today (these are the same command just different names, I can update this if you want to only keep one)
These commands can also take in an option argument afterwards (like the stats command, typed like /warlogs _day you want to look at_ => e.g. => /warlogs yesterday pulls yesterdays warlog snapshot from the end of the day
These are comprehensive logs, labeled with the day, the date, the war day, points/fame, decks used that day, decks used for the total war & non-participants for that day
Rocky — 1/2/26, 12:14 PM
These can also be posted publicly with the button in the response.

Finally you have access to an announcement command to ping users who have not used their decks yet, use this command in the #announcements channel, it's used /pingunuseddecks {announcement you want to send in channel}
This will tag every player with decks remaining
2 screenshots of the war logs being used, one without a day, the second one specifying /warlogs day:yesterday
Image
Image
Rocky — 1/2/26, 12:23 PM
Hope it works well, if you notice any issues or problems, or have any questions please let me know. & about developing an app, I figured out it's simpler than I thought except for publishing, that's a long process on iPhone for actual true inbuilt installable from the app store app, so I'm happy to start working on that if you still need, idk if you still need an app still but if you do need it let me know and like what is the purpose of it what is the main intention? What functionality do you need it to have? I remember you said you needed like a "scheduler" of a sort(?) but I don't think I ever really got into the functionality of it just did some scaffolding work.
I still have a folder on my desktop called "ManApp" 😭
Rocky — 1/2/26, 12:43 PM
Oh, and I don't know if I mentioned this, but to use a command just go to the channel and type a forward slash (/), recommended commands that are available in that channel then appear, you can click them or type them directly, if you want to specify a parameter after the command you just type a space after the command then type whatever the argument is [these are labeled and should pop up after pressing space what it is for if available] (example imagine /callsign is a command, to use an argument you would type/callsign _THE ARGUMENT YOU WANT_)
Man — 1/5/26, 9:58 AM
Wow! Code master!!
Rocky — 1/5/26, 10:11 PM
bots been down a couple days I'm working on a more permanant hosting solution, I was just running it on my laptop and that's prone to dying and just not good to host, so I got distracted coding something else but the bot should be back up and running tonight I hope
Rocky
started a call that lasted a few seconds. — 1/8/26, 7:13 PM
Rocky — 1/8/26, 7:14 PM
whoops didn't know that hotkey sorry lol
dude I never realized just how much you have to walk users through EVERYTHING with UI, like ik that sounds like a dumb remark like no shit it's the user interface, but I never realized how many people will just say something is going wrong because they're doing it wrong. Like because I didn't lock down viewing of every channel except the one you're supposed to put your tag in in discord, and even though it's labeled and at the top and literally right in front of you emani was like "it's not working" which like no foul to him it's my own bad I just never realized how like handholdy you have to be to get someone through setup/preliminary steps ig just a good lesson to me thought I'd share, I appreciate all the compliments you never let me know if you still needed that project or like what the purpose of it is. I stg it was like a scheduler you said like a mix of two apps but I just cannot remember it for the life of me, if you want me to work on it though I got through pretty much all the personal projects I needed to get through to actually run apps I've made previously (I can host my own server for websites & minecraft & the discord bot all at the same time 24/7 in the background [no extra windows] while my pc is on, I'm working on a private VPN rn (they have services for this but me being me) but that's out in the future bc I still need to do more research into the security of actually exposing it to being "publicly" accessible so I can use it for it's intended purpose), my point is, I have time, I have no projects, if you still need an app built let me know what it is in like a somewhat concise way and I'm happy to make it happen. The one shit thing about developing ios apps if I remember is I have to use xcode (apple's inbuilt ide) so my productivity is like 1/10thed, but I can make it work, I can probably link xcode's compiler to vs code somehow, and either way there are ways make pretty much any programming language into an app, so just lmk if you still are
in need of a program for your needs
idk if you are but if you do I need more portfolio projects & I'd be happy to help the best I can
Man — 1/9/26, 9:06 PM
You know Uber has 3 separate apps… I was thinking of something like that, but I couldnt remember if you said it was expensive?
Yeah, you are extremely good at coding, so people often get lazy and rely completely on you for the quick fix rather than using their brain lol.. I appreciate you for putting so much effort into making this team official af bruv. You Rock (Pun intended lol)
Rocky — 1/10/26, 1:10 PM
lol thx dawg, and yea I do, it’s not expensive it’s expensive in time, depending on the service you need it’s really quite simple
it gets more and more complex the more behaviors need to be handled, if payments need to be processed it’s another library, if you want google maps that’s an API, basically the building blocks already exist the simpler you can make the goal the better the agent is at sticking to building around that and the quicker it will be, but if you want a scheduler with payment processing and event handling so it only allows scheduling at open times and when you’re not already in an appointment or something the logic is simple enough but it is alot of logic, so like whatever you need don’t worry so much about the time or money, it’s free to code, the only thing I pay for is AI access so it’s not costing me more, I just need a clear goal of what the app(s) need to do, yes 3 interlinked apps is possible, 3 apps from the same base API (like all sharing a payment service) is as well, don’t worry so much about the logistics just what is needed if anything, if you need an app that is possible, if you need 3 apps also possible (idk how attainable for me as an individual in a reasonable amount of time, but possible)
Rocky — 1/10/26, 1:18 PM
basically if you can say I need it to do this is and this I can probably send you a website or dev environment that day doing those things, if you have a clearer goal for the project I can keep working and implementing things in tandem with that idea, whatever you need built can be built don’t worry so much about the logistics or how it can be done, that’s my specialty
3 independent apps is a massive amount of time, but technically no different than 1 app with 3 different service tabs
publishing is another story to get something on the app store is out of my control and in apple’s hands, so I could do something like a web app and a regular app until the regular app gets published so it’s functional, apparently doing something quick research though google says “90% of appd get reviewed within 24 hours” so it could be way quicker than I’m expecting, I’m just a realist and I know how some of these tech companies are with review times
Man — 1/10/26, 4:31 PM
Bro, you are extremely filthy. I never knew any of that, but you simplified it very well. I would definitely not feel right if down the line, the apps you made make me millions and you did it for free. If I start to make money off of this, I would be honored to work out a percentage plan, where you receive a certain percentage of the best 2 years of my sales. For example, if I make 20,000 first year if you got 5% you’d get 1,000, and the next year if it were 50,000, you’d get 2,500 more, total of 3,500z If there is a better year after the 2 years, you would get paid the difference between my worst year and that year. So basically if I make a million, you would receive $49,000 on 5% because of the difference between the worst year and the new top 2 years. If I made 2 million the next year, you would get 97,500. I dont have it perfected, but I feel that would be a respectful agreement, and after this, we would potentially negotiate partially ownership maybe, and/or partnership in new ideas.
Rocky — 1/11/26, 1:58 AM
absolutely, the money isn't the deciding factor for me, it's nice to have but I don't need it to do work, hell I've written atleast a million lines of code in the past year and not gotten paid a cent, it would be nice to get paid but also like 🤷‍♂️
you could give me stock or we could work something out when the app is done and making money, up to that point don't worry about reembursement
it helps my prospects of a job, and I just genuinely enjoy it, I just made my service manager live pull from github so my pc (which always runs) is able to get code from github and automatically run it 24/7, basically a "free" server, it's just fun to me, games are really damn difficult it's alot but possible and something I've been interested in, so idk if you got an idea let me know and I'd be happy to have a design partner
game, application, whatever you need/want if it's software based lmk and I'll do it, if it's for in person services (like you're a handyman or an "uber" like service [although you'd get more business on uber]) then just pay me like $10-$300 and I'll be happy, you're working for your own money there what I do isn't necessarily important just helpful
if it's a software you want to sell if it's a good idea that solves a problem I'm happy to make it but like 1% or 0.5% of the sales or if it goes public like stock would be cool, but again the money doesn't matter so much to me I'm fine living, it's helpful but let's talk project first before talking cuts, my only request is that even if not public I have access to the code to show potential employers, I wouldn't make it public especially if it needs to be secure, but just being able to still own what I write and I don't just have to hand it over exclusively and delete everything afterwards that'd be lit
Rocky — 1/11/26, 2:09 AM
and yea that "best of 2 years" is a good plan I do like that, however I don't want to cause more stress especially on a 5% cut, that'd be lit a 5% flat based upon what was made that year rather than having to match or do better than last year would be lit, even 2% at 1m in sales that's 20k which honestly after the service is made that's basically a free 20k I'm not doing much for, maybe some debugging/fixes or training/directing staff, but that's essentially 0 work 20k, so I almost feel bad with just that, if you had to match it every year I feel like it'd be more stressful than it needs to be this ain't a pension (as much as I do appreciate the offer) 😭😆
we can talk money more as it comes to fruition, but for now if you can give me

what the purpose?:

what the UI (graphics) should look like?:

what is the key idea of the program/what problem we're solving?:

what does it actually need to do? is it a shop? a service? what is being sold? is there something being sold is it a donation bin? 😂 crypto?:

just those 4 and I can get a pretty good idea of what needs to be done and actually have a direction to take it in from there I can send you updates and what's going on, and oh I actually kinda see what you mean with the payment, idk we can talk about it more don't worry so much about paying me I'm not that frugal, I'm happy on like a 1% flat tbh but we can work it out I wouldn't complain about 5% on that best of 2 years I am a little confused if you were to make 1m in the first year I'd get 50k, then if you made 2m the next year I'd also get 50k? bc 2nd year - 1st year = 50 then if you made 2m again the next year I'd get bumped to 100k? am I understanding?
Man — 1/11/26, 12:45 PM
You’d end up with 50K first year, and add 100K to that 50K for the 2million the next year, you’d have a total of 150K
Man — 1/11/26, 12:47 PM
I better get in while you still are doing coding like this!! Lol
Man — 1/11/26, 12:50 PM
The three apps would be “Triple A Musician” “Triple A Music” “Triple A Muse”.
Triple A Musician would be similar to the “Uber Driver” app, in that, the musician can see their rating, their bookings, their obligations, and see the perks they get like: Embroidery for branding, or free instrument rental for being a 5 star performer
Triple A Music would be like “Uber” would be for the customer, connecting them to musicians and locations to host events
“Triple A Muse” would be like “Uber Eats” (editing this for better reference) both the performer and the costumer become the consumer, where they would rent the instruments, get lessons, look at places they’d like me to come and help them set up stages for their performance etc.
Rocky — 1/12/26, 4:27 AM
would you want possible “subcontractors”/employees that you could assign specific tasks to as well on your end of the Triple A Muse app? For now I can just make it applicable to you but so I’m not rewriting code it’s best to have the broad picture in mind as well, I’m assuming it would be helpful but not super necessary to start?
And I like the plan, thx for laying it out so clearly, I’ll start ASAP, I’m trying to fix some issues with the clash bot but it’s just a headache bc of code reasons and my ability with my personal setup atm so I might just start
would you prefer a containing app for all 3 and have each be like a “subapp” or do you want 3 truely individual but interconnected apps? this is mainly just for my own setup sake so I know if I should make 3 buildable executables/program files or if I should setup the project to make just one, this can be changed later pretty easily I’ll probably setup the project simularly either way but just curious as to the vision you have in mind? would you like it to be one app where then the user can go to “musician” “music” or “muse” or do you want 3 independant apps like “Triple A Musician™️” “Triple A Music©️” and “Triple A Muse📑”?
Man — 1/12/26, 10:54 AM
Yes, I would want that.
Man — 1/12/26, 10:55 AM
I’d like 3 truly individual apps. Basically 3 separate businesses.
Man — 1/13/26, 4:55 PM
Full name:
William Anthony Moore III.

My cellphone number:
(253)-308-5140

Personal Email: LifeLivedBetter@yahoo.com
Rocky — 1/14/26, 12:25 AM
tripleamusic.org muse and musician are all available domain names if you want a web interface as well, I’ll send you the git repo when I make it and the live site when it’s published, right now it’s just kinda a web app I’m bundling for phones and I can bundle for desktop as well
& bet I’ll hit you up
Man — 1/14/26, 1:12 AM
.org is the domain that is available for all three but not “.com” right? I like org, just asking.
That sounds great about the bundling
Rocky — 1/14/26, 1:13 AM
yea, .com tripleamusic isn't available at all just up for offer, which speaking from experience generally means they're looking for 20+ thousand
which I assume is just like more than worth it for just launching the service
Man — 1/14/26, 1:14 AM
Lmao
Rocky — 1/14/26, 1:14 AM
it is a plausable investment but in my opinion money like that can be used for much better things
the .orgs are all $7.50 a piece
so $22 total
for all 3
Man — 1/14/26, 1:14 AM
Im sure if the business is successful, I’ll have the 20K to make that investment, so I like org
Rocky — 1/14/26, 1:15 AM
I don't have to bundle it on the web either, I can just make a standalone app if you prefer, just for development though having a site you can view and comment on is easier bc it's live for both of us all the time rather than you having to download something or run it on a computer every time
Man — 1/14/26, 1:15 AM
Do you have a way I can transfer the funds to you for that?
Bundle is fine
Rocky — 1/14/26, 1:16 AM
and yea, also you can keep the .org and just add the .com later on, it's basically just 4 values you gotta type in the right spot, and yea dw about that rn I doubt they'll be gone anytime soon, but if you want to zelle me and I can lock them down for a year my phone is 4357317654 or email alexwaldmann2004@gmail.com
so like the .org and .com could point to the same location, just two different domains
honestly I think .org sounds more professional like .organization, idk might just be me lol
Man — 1/14/26, 1:17 AM
I agree
Rocky — 1/14/26, 1:17 AM
Here actually can you just do it so you actually own the domain name and it doesn't fail if my card doesn't go through
then you also have the ability to prolong subscriptions, auto renew all of that
I don't want to make a full account for you like I did Nat bc passwords are a bit more personal info than I need 😭
here
https://www.namecheap.com/domains/registration/results/?domain=tripleamusic.org https://www.namecheap.com/domains/registration/results/?domain=tripleamuse.org
https://www.namecheap.com/domains/registration/results/?domain=tripleamusician.org
Sign up here
https://www.namecheap.com/myaccount/signup/
Once you've paid for them it'll be yours for a year, you can choose to autorenew so you don't lose it, I think renewal is like $10 each? idk it says in small text beneath the price
I will only need some very small things from there and I'm sure you are more than able to set it up, plus if you do get the .coms in the future you already know how to set them up, don't feel like you need to do it tonight but just so it's actually tied to your name and you are the rightful legal owner of the domain you should buy it
I could buy it for you but then technically it's in my name and my responsibility and honestly I already run 2 accounts with like 4 domains, I would prefer it to just be auto on your card given I'm a broke student and there's a 50/50 shot that renewal payment isn't going to be good 😆
Rocky — 1/14/26, 1:42 AM
Where do you want the admin page wired in? like admin.tripleamuse.com? any admin. prefix? no admin. prefix at all just a default login form for all users?
Man — 1/14/26, 1:43 AM
Image
Rocky — 1/14/26, 1:43 AM
sorry, admin login and also admin, it can really simply be like /admin (I'll do that for the time being) but if you prefer the admin. prefix I'm happy to change that
Man — 1/14/26, 1:43 AM
Password is “ROCK2026!”
Username: 3AMYou
Rocky — 1/14/26, 1:46 AM
oh word, uhh ik this is a strange request but could you buy the domain names themselves? It'll let you 1) write it off as a business expense and 2) in case my autorenew fails (bc I'm broke as shit lol) it won't just remove the domain name from your presense, I'm happy to set it up for the time being but you should later on change the fallback card and prolly the password
for now though I'll set it up if you want to reemburse me I can send the final reciept
Man — 1/14/26, 1:46 AM
I bought all the domain names under that password
Rocky — 1/14/26, 1:47 AM
OH BET
ok lit, I will link the DNS/name servers in a bit
Man — 1/14/26, 1:48 AM
I dont understand this.. can you explain a little more what you mean?
Rocky — 1/14/26, 1:48 AM
I'll probably be changing some things around with my hosting setup later on, but for now atleast we can get a decent running result, I'll just set it up on Netlify for rn [can be expensive as time goes on but for testing it's great and free]. I'll send you the links when they're live, when I get the final hosting setup running I'll get you a VPN key and my VPN program
Man — 1/14/26, 1:49 AM
Great!
Rocky — 1/14/26, 1:49 AM
oh yea, sorry, DNS (domain name service) basically tells the webservers themselves (what stores the data and where) that that IP links to that name
"name servers" are just another name
basically without them every website would be like 12.124.248.12.32 (or whatever, just a bunch of numbers, "pure" IPs)
Man — 1/14/26, 1:50 AM
Admin prefix meaning “Admin” or “www”?
Rocky — 1/14/26, 1:51 AM
technically the full thing would be www.admin.domain.org but this can be configured so there is no www. prefix and such, it'd just show admin.domain.org in the URL
it's just a slight amount of seperation between users and admins, it doesn't really add any security or anything just preference on how you want it to look, at the end of the day though if you're wanting apps it really doesn't matter how it's done
Man — 1/14/26, 1:54 AM
I believe in you guy!
Rocky
started a call that lasted an hour. — 1/14/26, 4:16 PM
Rocky — 1/14/26, 5:04 PM
https://www.w3schools.com/
W3Schools offers free online tutorials, references and exercises in all the major languages of the web. Covering popular subjects like HTML, CSS, JavaScript, Python, SQL, Java, and many, many more.
Image
Rocky — 1/20/26, 1:32 PM
Hey on the Music site do you want "customers" (not event hosts but like the people who would go to the event) to be able to login (or not login) into "Music" and place orders for tickets? You could be like a seatgeek or tix24 or whatever it is for these venues if they end up using your site, would that be of interest to you? There could be a flat like 1% fee for using the site and we can always discuss and change where you want to draw profits from but I think it'd be good if it's a one stop shop to cater to artists and hosts of events, having a place for hosts to easily sell entry into their event would probably get even more cash flowing through and it would be even more incentive to work with you, like they literally just go through a form of either uploading the venue and allowing people to apply, or they themselves as the host can request a certain artist on a certain day/time, and then tickets are literally just a checkbox if they want them sold, no other sites they have to go through and all the money associated with the business (outside of merch being sold for artists on the site which could later be implemented but isn't currently) is flowing through you, I think it'd be beneficial and it would incentivize more people to use your service, I could even look into ways that this could be implemented with these already existing ticket vendor sites so tickets don't get oversold and your site accurately reports the seatcount left to these external sites, it could even be like an integration when the host can link to these other vendors and then tickets get posted automatically there as well (or atleast I'm pretty sure as long as there's an API it's possible I'm sure)
I'll send you the links to the sites later today I'll probably get them published to atleast a dev environment today, it might be on all one site just like music.whatever.com or muse.whatever.com for the time being given it's a monorepo and I don't want to split this into 3 repos/tinker with netlify for multiple days to get that to work, but however it's done I'll keep you posted, just would you be interested in also catering to people wanting to go to these events in/as the form of a/the ticket vendor for the event?
Man — 1/20/26, 2:29 PM
I love that! Maybe this would be a good option for the artist to turn an “Open For Tickets” setting on or off depending on if we have the layout for the venue or not (assigned seeting tickets would cost more than “at the door” tickets), if they just want their friends to watch them, or if they are a 4star performer or better. This may be difficult, because there are so many places to perform that arent duplicated in other states, for example: Mcdonald’s is in every state, so Uber Eats just copies and pastes the menu, but a “Club X” is like one of 5000 places to sing, so getting layouts would be a lot more work. But I agree with you, and would 100% want to develop this idea as a secret feature artists get surprised, and hyped by.
And yes, I would like to be the ticket vendor
Rocky — 1/20/26, 2:46 PM
The venue itself would set the seat capacity and then users could link to 24tix or whatever it is, idk if there is a way to get affiliate links or whatever we could deal with that when we get to it. The venue itself as it lists will set the seating capacity, musicians could apply to the venue or the venue host themself could request an artist at their price/at an offered price. The tickets would solely be based on the capacity of the venue that was set by the host not by the artist or by you or anyone else, each type of user should be able to set up their profiles/events/links/whatever so the site itself handles most of the logistics, the artist basically has their schedule and a dashboard where they can request things from you, "hosts" can post new venues/events looking for talent, and you and your crew basically act as orchestrators for getting the event setup, or your profit simply comes from ticket sales or just being the facilitator, preferably low fees like $1-2 for each ticket and maybe like 1% max of $20 on the venue (I think that's fair and customers/hosts would be happy to pay that for the simplicity, but feel free to lmk) or if you are booked to help setup you would get your pay for that as well obviously bc that's active work, but as a marketplace those would be your fees then whatever services you want to offer I'll try to make a way for them to easily be setup, but each category/service initial setup will probably have to be coded rather than just having like a dynamic system. All items within these categories could be dynamic (like all your instrument rentals, your different packages for setting up venues, but these different views like "Rentals", "Bundles"... etc would have to be set up by hand but I'll think on it if there's a better way). Either way I'll get the system working as a marketplace facilitator for as much as I can, it's complex but not difficult just alot
Man — 1/20/26, 3:56 PM
I was interested in getting the layout of these places to be the exclusive ticket vendor. Uber Eats gets paid by the customer, and then pays McDonald’s. I was hoping to pay the Venue, and control everything over the top. I like the 24tix, I would just be unsure, because idk if they would sell tickets for a local lounge or something. I agree 100% with you, I just want to make sure I have everything covered.
Rocky — 1/20/26, 10:29 PM
"this exactly: Host (Music) = authoritative/operational, a place for people to browse upcoming events or post an event looking for an artist, Musician = crisp/work-dashboard, Muse = brand/front-door, “Apple service calm” vs more “Uber ops/dispatch” doesn't really make too much sense to me, but I want musicians to feel welcomed in and like they're joining the family, muse should be a clean concise and simple way for people to preview services offered and get to the proper dashboard for whatever they are trying to do, music should feel like a place for people to browse...?? (All upcoming events and concerts being offered??)"
Man — 1/21/26, 12:56 PM
Muse was to be more like “uber eats”
Music is Uber, that matches “authoritative/operational imo
Musician is similar to “Uber Driver”
I should’ve corrected this earlier!
Man — 1/21/26, 1:16 PM
The only one I would tell ai I want to be like is Muse (Uber Eats) and Musician (Uber Driver)… maybe Music (Uber)
Man — 3:43 PM
I got a $23.04 refund from namecheap.com should I be aware of anything?
Rocky — 10:05 PM
Uhhh?? No? I don't believe so?
I'll look on the account to see what I can find if there is payment history or if you want to scour for it I'm sure you can figure out what it is, but idk that's strange?
Maybe some configuration/registration thing where it charged you for some option or like not as a first time purchase and then the system caught up with what the offer actually was or smth?
Honestly I'm not sure?

﻿
Man
maniskind
